import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { emvCrc } from '@midpoint/payment-qr';
import { Keypair } from '@stellar/stellar-sdk';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '@/app.factory';
import { loadConfig } from '@/config/env';
import {
  DevApi,
  devChain,
  devDollar,
  keypair,
  localApiEnv,
  newDevAccounts,
  seedDevMarket,
  setUpDevMarket,
  signAndSubmit,
  signIn,
  startLocalStellar,
  type DevAccounts,
  type DevChain,
  type RunningLocalStellar,
  type SeedResult,
} from '@/dev/index';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * The market end to end on a real Stellar network: `E2E_STELLAR=testnet`
 * (friendbot) or `E2E_STELLAR=local` (the quickstart container, which needs
 * a running Docker daemon). It deploys a fresh market, boots the API with its
 * jobs, seeds it through the API, and runs every flow the app offers. Slow
 * (minutes): never part of the default `npm test`.
 */

const NETWORK = process.env.E2E_STELLAR;
const WEB_ORIGIN = 'http://localhost:3100';
const U = 10_000_000n;

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** A dynamic interoperable QR (Argentina) for `amount` ARS, CRC included. */
function arQr(amount: string, reference: string): string {
  const body = `${[
    tlv('00', '01'),
    tlv('01', '12'),
    tlv('43', `${tlv('00', 'com.mercadolibre')}${tlv('01', 'shop-1')}`),
    tlv('52', '5812'),
    tlv('53', '032'),
    tlv('54', amount),
    tlv('58', 'AR'),
    tlv('59', 'PANADERIA EL HORNERO'),
    tlv('60', 'BUENOS AIRES'),
    tlv('62', tlv('05', reference)),
  ].join('')}6304`;
  return `${body}${emvCrc(body)}`;
}

async function until<T>(read: () => Promise<T>, done: (v: T) => boolean, ms = 180_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > end) throw new Error(`timed out; last: ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

describe.skipIf(NETWORK !== 'testnet' && NETWORK !== 'local')('the market on Stellar', () => {
  let app: INestApplication;
  let api: DevApi;
  let chain: DevChain;
  let local: RunningLocalStellar | undefined;
  let accounts: DevAccounts;
  let seed: SeedResult;
  let user: Keypair;
  let userSession: string;
  /** The market's dollar: Circle's USDC on testnet, the stack's TUSD on the local network. */
  let dollar: string;

  type Order = { id: string; status: string; [k: string]: unknown };
  const order = (session: string, id: string) =>
    api.call<Order>('GET', `/v1/app/orders/${id}`, session);
  const waitStatus = (session: string, id: string, status: string) =>
    until(
      () => order(session, id),
      (o) => o.status === status || ['failed', 'cancelled', 'expired'].includes(o.status),
    ).then((o) => {
      expect(o.status).toBe(status);
      return o;
    });

  beforeAll(async () => {
    if (NETWORK === 'local') {
      local = await startLocalStellar();
      chain = devChain('local', local);
    } else {
      chain = devChain('testnet');
    }
    accounts = newDevAccounts();
    const market = await setUpDevMarket(chain, accounts);
    dollar = devDollar(chain, market).symbol;
    const env = localApiEnv({
      // A placeholder: the app below listens on a free port.
      port: 4999,
      databaseUrl: inject('infra').databaseUrl,
      chain,
      market,
      accounts,
      dataEncryptionKey: randomBytes(32).toString('hex'),
      webOrigin: WEB_ORIGIN,
      jobsEnabled: true,
      jobIntervalMs: 1000,
    });
    app = await createApp(loadConfig(env), { logger: false });
    await app.listen(0, '127.0.0.1');
    const url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    api = new DevApi(url, WEB_ORIGIN);
    seed = await seedDevMarket({ apiUrl: url, webOrigin: WEB_ORIGIN, chain, market, accounts });
    user = keypair(accounts.user);
    userSession = await signIn(api, user);
  });

  afterAll(async () => {
    await app?.close();
    local?.stop();
  });

  it('activates a new account through the sponsor: created with 0 XLM, trustline open', async () => {
    const friend = Keypair.random();
    const session = await signIn(api, friend);
    const before = await api.call<{ account: { exists: boolean } }>(
      'GET',
      '/v1/app/balances',
      session,
    );
    expect(before.account.exists).toBe(false);
    const { transaction } = await api.call<{ transaction: { xdr: string; network: string } }>(
      'POST',
      '/v1/app/activate',
      session,
      { token: dollar },
    );
    await signAndSubmit(api, session, 'app', transaction, friend, chain.passphrase);
    const after = await api.call<{
      account: { exists: boolean };
      xlm: string;
      tokens: { symbol: string; trustline: boolean }[];
    }>('GET', '/v1/app/balances', session);
    expect(after.account.exists).toBe(true);
    expect(after.xlm).toBe('0');
    expect(after.tokens.find((t) => t.symbol === dollar)?.trustline).toBe(true);
    const again = await api.call<{ transaction: unknown }>('POST', '/v1/app/activate', session, {
      token: dollar,
    });
    expect(again.transaction).toBeNull();

    // A transfer to its handle: a classic payment, gasless.
    const handle = `friend_${Date.now().toString(36).slice(-6)}`;
    await api.call('PUT', '/v1/app/profile', session, { handle });
    const sent = await api.call<{
      transfer: { id: string; toHandle: string };
      transaction: { xdr: string; network: string };
    }>('POST', '/v1/app/transfers', userSession, {
      to: `@${handle}`,
      token: dollar,
      amount: (2n * U).toString(),
      note: 'empanadas',
    });
    expect(sent.transfer.toHandle).toBe(handle);
    await signAndSubmit(api, userSession, 'app', sent.transaction, user, chain.passphrase);
    const done = await until(
      () =>
        api.call<{ status: string }>('GET', `/v1/app/transfers/${sent.transfer.id}`, userSession),
      (t) => t.status === 'COMPLETED',
    );
    expect(done.status).toBe('COMPLETED');
    const activity = await api.call<{
      items: { type: string; transfer?: { direction: string; amount: string } }[];
    }>('GET', '/v1/app/activity', session);
    expect(activity.items).toContainEqual(
      expect.objectContaining({
        type: 'transfer',
        transfer: expect.objectContaining({ direction: 'in', amount: (2n * U).toString() }),
      }),
    );
  });

  it('runs a purchase: matcher open, paid, the merchant releases, completed', async () => {
    const quote = await api.call<{ id: string; tokenAmount: string }>(
      'POST',
      '/v1/app/quotes',
      userSession,
      {
        side: 'BUY',
        network: chain.network,
        token: dollar,
        currency: 'ARS',
        rail: 'ar_bank_transfer',
        fiatAmount: '12500',
      },
    );
    const created = await api.call<Order>('POST', '/v1/app/orders', userSession, {
      quoteId: quote.id,
      payer: { name: 'Juan Gomez', document: '20123456786' },
    });
    const open = await waitStatus(userSession, created.id, 'awaiting_payment');
    expect(open.paymentDetails).toMatchObject({ rail: 'ar_bank_transfer' });
    await api.call('POST', `/v1/app/orders/${created.id}/paid`, userSession, {
      reference: 'TRX-1',
    });
    await waitStatus(userSession, created.id, 'paid');
    await api.call('POST', `/v1/dev/orders/${created.id}/simulate-transfer`, null);
    const completed = await waitStatus(userSession, created.id, 'completed');
    expect(completed.settlement).toMatchObject({ toBuyer: '99500000', protocolFee: '500000' });
  });

  it('runs a sale: the seller signs open_with_deposit, the merchant accepts and pays, the seller releases', async () => {
    const quote = await api.call<{ id: string }>('POST', '/v1/app/quotes', userSession, {
      side: 'SELL',
      network: chain.network,
      token: dollar,
      currency: 'ARS',
      rail: 'ar_bank_transfer',
      fiatAmount: '11800',
    });
    const created = await api.call<
      Order & { transactions: { xdr: string; network: string; action: string }[] }
    >('POST', '/v1/app/orders', userSession, {
      quoteId: quote.id,
      beneficiary: {
        holderName: 'Ana Lopez',
        document: '27234567891',
        details: { cbu: '2850590940090418135201', cuit: '27234567891' },
      },
    });
    expect(created.transactions.map((t) => t.action)).toEqual(['open_with_deposit']);
    await signAndSubmit(api, userSession, 'app', created.transactions[0], user, chain.passphrase);
    await waitStatus(userSession, created.id, 'awaiting_acceptance');
    await api.call('POST', `/v1/dev/orders/${created.id}/simulate-transfer`, null);
    await waitStatus(userSession, created.id, 'paid');
    const release = await api.call<{ xdr: string; network: string; action: string }>(
      'POST',
      `/v1/app/orders/${created.id}/transactions`,
      userSession,
      { action: 'release' },
    );
    expect(release.action).toBe('release');
    await signAndSubmit(api, userSession, 'app', release, user, chain.passphrase);
    await waitStatus(userSession, created.id, 'completed');
  });

  it('pays a shop’s QR through a merchant (QR_PAY), the QR shown only to that merchant while live', async () => {
    const qr = arQr('5950.00', `T${Date.now().toString(36)}`);
    const quote = await api.call<{ id: string; kind: string; qr: { merchantName: string } }>(
      'POST',
      '/v1/app/quotes',
      userSession,
      { kind: 'QR_PAY', network: chain.network, token: dollar, qr },
    );
    expect(quote).toMatchObject({ kind: 'QR_PAY', qr: { merchantName: 'PANADERIA EL HORNERO' } });
    const created = await api.call<Order & { transactions: { xdr: string; network: string }[] }>(
      'POST',
      '/v1/app/orders',
      userSession,
      { kind: 'QR_PAY', quoteId: quote.id, qr },
    );
    expect(created.kind).toBe('QR_PAY');
    await signAndSubmit(api, userSession, 'app', created.transactions[0], user, chain.passphrase);
    await waitStatus(userSession, created.id, 'awaiting_acceptance');
    const asMerchant = await api.call<{ qr: { payload: string } | null }>(
      'GET',
      `/v1/p2p/merchant/orders/${created.id}`,
      seed.merchant.apiKey,
    );
    expect(asMerchant.qr?.payload).toBe(qr);
    await api.call('POST', `/v1/dev/orders/${created.id}/simulate-transfer`, null);
    await waitStatus(userSession, created.id, 'paid');
    const release = await api.call<{ xdr: string; network: string }>(
      'POST',
      `/v1/app/orders/${created.id}/transactions`,
      userSession,
      { action: 'release' },
    );
    await signAndSubmit(api, userSession, 'app', release, user, chain.passphrase);
    await waitStatus(userSession, created.id, 'completed');
    const ended = await api.call<{ qr: unknown }>(
      'GET',
      `/v1/p2p/merchant/orders/${created.id}`,
      seed.merchant.apiKey,
    );
    expect(ended.qr).toBeNull();
  });

  it('pays a business’s charge from the balance: the charge is paid once the transfer succeeds', async () => {
    const charge = await api.call<{ payWithBalance: { amount: string; recipient: string } | null }>(
      'GET',
      `/v1/app/charges/${seed.charge.id}`,
      userSession,
    );
    expect(charge.payWithBalance?.recipient).toBe(seed.business.address);
    const paid = await api.call<{
      payment: { id: string; status: string };
      transaction: { xdr: string; network: string };
    }>('POST', `/v1/app/charges/${seed.charge.id}/payments`, userSession, { token: dollar });
    expect(paid.payment.status).toBe('PENDING');
    await signAndSubmit(api, userSession, 'app', paid.transaction, user, chain.passphrase);
    const asBusiness = await until(
      () =>
        api.call<{ paidCount: number }>(
          'GET',
          `/v1/p2p/charges/${seed.charge.id}`,
          seed.business.apiKey,
        ),
      (c) => c.paidCount >= 1,
    );
    expect(asBusiness.paidCount).toBeGreaterThanOrEqual(1);
    const events = await app.get(PrismaService).webhookEvent.findMany({
      where: { organizationId: seed.business.organizationId, type: 'P2P_CHARGE_SUCCEEDED' },
    });
    expect(
      events.map((e) => (e.payload as { data: { paidWith: string } }).data.paidWith),
    ).toContain('TOKEN');
  });
});
