import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SessionPrincipal } from '@/auth/auth.types';
import { ChainCallReverted, ChainClient } from '@/chain/chain-client.service';
import { DeploymentsService, type Deployment } from '@/chain/deployments.service';
import { MarketReader } from '@/chain/market-reader.service';
import { isNativeToken, type Tier, type Token } from '@/chain/networks';
import { TxBuilder } from '@/chain/tx-builder.service';
import { ApiError, ErrorCode } from '@/common/api-error';
import { isContractAddress } from '@/common/stellar';
import { CheckoutService } from '@/p2p/checkout.service';
import { P2P_CHARGE_LOCK_CLASS, P2P_CHARGE_PAYMENT_TTL_SECONDS } from '@/p2p/domain/constants';
import { isUuid } from '@/p2p/domain/order-ref';
import { P2P_LIVE_STATUSES } from '@/p2p/domain/order-status';
import { isQrRail, railsFor } from '@/p2p/domain/rails';
import type { PayChargeDto } from '@/p2p/dto/app-wallet.dto';
import type {
  AppChargeView,
  ChargePaymentView,
  CreatedChargePaymentView,
  PayWithBalanceView,
} from '@/p2p/entities/app-wallet.entity';
import { QuotesService, fiatUnitsOf } from '@/p2p/quotes.service';
import { P2P_CHARGE_SELECT, chargeStatus, type P2pChargeRow } from '@/p2p/views';
import { PrismaService } from '@/prisma/prisma.service';

type ChargeRow = P2pChargeRow & { organizationId: string };

/**
 * Paying a business's charge from the wallet's balance (no merchant in
 * between): the token amount is what the business would have received
 * through the market, priced from the current best quote and held for 60 s,
 * and the transaction is a plain token transfer to the charge's receiving
 * account. The charge counts as paid only once that transfer succeeded
 * on-chain (`SubmissionsService` settles it, with `P2P_CHARGE_SUCCEEDED`
 * and `paidWith: 'TOKEN'`). The local-money checkout (`/pay/{id}`) stays.
 *
 * A single-use charge takes one payment at a time: while an order or another
 * unexpired payment is under way, a new payment is `409`.
 */
@Injectable()
export class AppChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
    private readonly reader: MarketReader,
    private readonly chain: ChainClient,
    private readonly builder: TxBuilder,
    private readonly quotes: QuotesService,
    private readonly checkout: CheckoutService,
  ) {}

  private async charge(id: string): Promise<ChargeRow> {
    const row = isUuid(id)
      ? await this.prisma.p2pCharge.findUnique({
          where: { id },
          select: { ...P2P_CHARGE_SELECT, organizationId: true },
        })
      : null;
    if (!row) throw ApiError.notFound(`Charge ${id} not found`);
    return row;
  }

  /**
   * The tokens the business would receive for the charge's amount through
   * the best purchase quote on any of its currency's rails, or null.
   */
  private async price(d: Deployment, token: Token, charge: ChargeRow): Promise<bigint | null> {
    const protocol = await this.quotes.openProtocol(d);
    let best: bigint | null = null;
    for (const rail of railsFor(charge.currency).filter((r) => !isQrRail(r))) {
      const match = await this.quotes.match({
        deployment: d,
        token,
        side: 'BUY',
        currency: charge.currency,
        rail,
        fiatUnits: fiatUnitsOf(charge.currency, charge.fiatAmount),
        protocolFeeBps: protocol.feeBps,
        integratorFeeBps: 0,
        counterparty: charge.recipientAddress,
      });
      if (match && (best === null || match.amounts.netTokens > best))
        best = match.amounts.netTokens;
    }
    return best;
  }

  private async live(charge: ChargeRow): Promise<{ d: Deployment; token: Token }> {
    const d = await this.reader.requireLive(charge.tier as Tier, charge.network);
    const token = d.tokens.find((t) => t.contract === charge.token);
    if (!token) {
      throw ApiError.unavailable('This charge’s token is not served right now.', charge.token);
    }
    return { d, token };
  }

  async get(_session: SessionPrincipal, id: string): Promise<AppChargeView> {
    const charge = await this.charge(id);
    const base = await this.checkout.getCharge(id);
    let payWithBalance: PayWithBalanceView | null = null;
    if (chargeStatus(charge, new Date()) === 'open') {
      try {
        const { d, token } = await this.live(charge);
        const amount = await this.price(d, token, charge);
        if (amount !== null) {
          payWithBalance = {
            token: token.symbol,
            tokenContract: token.contract,
            amount: amount.toString(),
            recipient: charge.recipientAddress,
            expiresAt: new Date(Date.now() + P2P_CHARGE_PAYMENT_TTL_SECONDS * 1000),
          };
        }
      } catch {
        payWithBalance = null;
      }
    }
    return {
      id: base.id,
      network: base.network,
      tokenSymbol: base.tokenSymbol,
      currency: base.currency,
      fiatAmount: base.fiatAmount,
      merchantName: base.merchantName,
      description: base.description,
      status: base.status,
      rails: base.rails,
      expiresAt: base.expiresAt,
      payWithBalance,
    };
  }

  async pay(
    session: SessionPrincipal,
    id: string,
    dto: PayChargeDto,
  ): Promise<CreatedChargePaymentView> {
    const charge = await this.charge(id);
    const now = new Date();
    if (chargeStatus(charge, now) !== 'open') {
      throw ApiError.conflict(
        ErrorCode.ChargeClosed,
        `Charge ${id} is ${chargeStatus(charge, now)}: it can no longer be paid`,
      );
    }
    if (dto.network && dto.network !== charge.network) {
      throw ApiError.validation([`this charge is paid on ${charge.network}`]);
    }
    const { d, token } = await this.live(charge);
    if (this.deployments.findToken(d, dto.token)?.contract !== token.contract) {
      throw ApiError.validation([`this charge is paid in ${token.symbol}`]);
    }
    if (charge.recipientAddress === session.address) {
      throw ApiError.validation(['you cannot pay your own charge']);
    }
    const amount = await this.price(d, token, charge);
    if (amount === null) {
      throw ApiError.conflict(
        ErrorCode.NoMatch,
        'No quote prices this charge right now: try again shortly, or pay it in local money.',
      );
    }
    const [own] = await this.chain.trustlines(d, session.address, [token]);
    if (!own || !own.authorized || own.balance < amount) {
      throw ApiError.badRequest(
        ErrorCode.InsufficientBalance,
        `Paying this charge takes ${amount} base units of ${token.symbol}: your balance is not enough.`,
      );
    }
    let transaction;
    try {
      // A contract recipient, and the native lumen always, take a SAC `transfer`.
      transaction =
        isContractAddress(charge.recipientAddress) || isNativeToken(token)
          ? await this.builder.sacTransfer(
              d,
              session.address,
              charge.recipientAddress,
              token,
              amount,
              P2P_CHARGE_PAYMENT_TTL_SECONDS,
            )
          : await this.builder.payment(
              d,
              session.address,
              charge.recipientAddress,
              token,
              amount,
              null,
              P2P_CHARGE_PAYMENT_TTL_SECONDS,
            );
    } catch (err) {
      if (err instanceof ChainCallReverted) {
        throw ApiError.badRequest(
          ErrorCode.RecipientCannotReceive,
          'The charge’s account cannot receive it.',
        );
      }
      throw err;
    }
    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${P2P_CHARGE_LOCK_CLASS}::int, hashtext(${charge.id}))`;
      if (!charge.multiUse) {
        const [orders, payments] = await Promise.all([
          tx.p2pOrder.count({
            where: { chargeId: charge.id, status: { in: [...P2P_LIVE_STATUSES] } },
          }),
          tx.p2pChargePayment.count({
            where: {
              chargeId: charge.id,
              OR: [
                { status: 'SUBMITTED' },
                { status: 'PENDING', expiresAt: { gt: now } },
                { status: 'COMPLETED' },
              ],
            },
          }),
        ]);
        if (orders > 0 || payments > 0) {
          throw ApiError.conflict(
            ErrorCode.OperationInFlight,
            'Someone is paying this charge right now: try again when their payment ends.',
          );
        }
      }
      return tx.p2pChargePayment.create({
        data: {
          id: randomUUID(),
          chargeId: charge.id,
          tier: charge.tier,
          network: charge.network,
          token: token.contract,
          tokenSymbol: token.symbol,
          amount: amount.toString(),
          payerAddress: session.address,
          recipientAddress: charge.recipientAddress,
          hash: transaction.hash,
          expiresAt: transaction.expiresAt,
        },
      });
    });
    return { payment: paymentView(payment), transaction };
  }
}

export function paymentView(row: {
  id: string;
  chargeId: string;
  network: string;
  token: string;
  tokenSymbol: string;
  amount: string;
  status: string;
  hash: string;
  expiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}): ChargePaymentView {
  return {
    id: row.id,
    chargeId: row.chargeId,
    network: row.network,
    token: row.tokenSymbol,
    tokenContract: row.token,
    amount: row.amount,
    status: row.status,
    hash: row.hash,
    expiresAt: row.expiresAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}
