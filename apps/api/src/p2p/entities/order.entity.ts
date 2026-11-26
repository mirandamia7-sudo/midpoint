import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { P2P_QR_STANDARDS } from '@/p2p/domain/rails';
import { OrderChatSummaryView } from '@/p2p/entities/order-message.entity';
import { TransactionView } from '@/p2p/entities/transaction.entity';

const STATUSES = [
  'pending',
  'awaiting_acceptance',
  'awaiting_payment',
  'paid',
  'disputed',
  'completed',
  'cancelled',
  'expired',
  'resolved',
  'failed',
];

@ApiSchema({ description: 'The transactions an order went through, by step.' })
export class OrderTxHashesView {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '6b1f8c3e2d7a4b5c9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f',
  })
  open!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  accept!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  paid!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  release!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  cancel!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  dispute!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  resolve!: string | null;
}

@ApiSchema({ description: 'What an order paid out when it ended, base units.' })
export class OrderSettlementView {
  @ApiProperty({
    example: '99500000',
    description: 'To the buyer of the tokens, after fees.',
  })
  toBuyer!: string;

  @ApiProperty({ example: '0', description: 'Back to the seller.' })
  toSeller!: string;

  @ApiProperty({
    example: '0',
    description: 'Of the buyer’s bond, to the seller (a resolution only).',
  })
  bondToSeller!: string;

  @ApiProperty({ example: '500000' })
  protocolFee!: string;

  @ApiProperty({ example: '0' })
  integratorFee!: string;
}

@ApiSchema({
  description:
    "The merchant's account to pay, shown to the client of a live purchase or charge only.",
})
export class PaymentDetailsView {
  @ApiProperty({ example: 'bo_bank_transfer' })
  rail!: string;

  @ApiProperty({
    example: 'María Pérez',
    description: 'The holder the transfer goes to.',
  })
  holderName!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      bank: 'Banco Unión',
      accountType: 'savings',
      accountNumber: '1000012345678',
      documentType: 'NIT',
      documentNumber: '1023456789',
    },
  })
  details!: Record<string, string>;
}

@ApiSchema({ description: 'The merchant of an order, as its client sees it.' })
export class OrderMerchantView {
  @ApiProperty({ type: String, nullable: true, example: 'Oriente Cambio' })
  displayName!: string | null;
}

@ApiSchema({
  description:
    'What a QR payment’s scanned QR reads, for the person who scanned it (never the payload itself).',
})
export class QrSummaryView {
  @ApiProperty({ enum: P2P_QR_STANDARDS, example: 'pe-interoperable' })
  standard!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Bodega Lucho' })
  merchantName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Cusco' })
  merchantCity!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '45.00',
    description: 'The amount a dynamic QR asks for; null for a static one.',
  })
  amount!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'BOB' })
  currency!: string | null;
}

@ApiSchema({
  description:
    'A QR payment’s scanned QR, for its merchant while the order is live: draw the QR from `payload` and pay it with your banking app, then mark the order paid.',
})
export class MerchantQrView {
  @ApiProperty({
    example: '0002010102123944Zm9vYmFy...6304ABCD',
    description: 'The exact text scanned (EMV), CRC included.',
  })
  payload!: string;

  @ApiProperty({ enum: P2P_QR_STANDARDS, example: 'pe-interoperable' })
  standard!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Bodega Lucho' })
  merchantName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Cusco' })
  merchantCity!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '45.00' })
  amount!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'BOB' })
  currency!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'TICKET-0042' })
  reference!: string | null;
}

/** An order as the client (the organization that created it) reads it. */
@ApiSchema({
  description:
    'A P2P order as the organization that created it sees it. `status` moves only on what the chain shows: `pending` (the opening transaction is not indexed yet, or a sale waits for the seller’s signature), `awaiting_acceptance`, `awaiting_payment`, `paid`, `disputed`, then `completed`, `cancelled`, `expired` (cancelled after a deadline), `resolved` (by the arbiter) or `failed` (never opened).',
})
export class OrderView {
  @ApiProperty({ example: '3f1c2b7e-8d4a-4c1e-9b2f-6a5d4c3b2a10' })
  id!: string;

  @ApiProperty({
    enum: ['BUY', 'SELL', 'QR_PAY', 'CHARGE', 'PAYOUT'],
    example: 'BUY',
    description:
      'BUY: a person buys tokens from a merchant. SELL: a person sells tokens to a merchant. QR_PAY: a person pays a shop’s local-money QR through a merchant that buys their tokens. CHARGE: a payer pays one of your charges. PAYOUT: a merchant pays a beneficiary from your balance.',
  })
  kind!: string;

  @ApiProperty({ enum: STATUSES, example: 'awaiting_payment' })
  status!: string;

  @ApiProperty({ enum: ['live', 'test'], example: 'test' })
  tier!: string;

  @ApiProperty({ example: 'testnet' })
  network!: string;

  @ApiProperty({ example: 'CAKGHC55HFGIGFDRKKLH7MYLVXE5ELAO57VE2VUCDXBWDVFNDIXXZTJ7' })
  contract!: string;

  @ApiProperty({ example: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA' })
  token!: string;

  @ApiProperty({ example: 'USDC' })
  tokenSymbol!: string;

  @ApiProperty({ example: 7 })
  tokenDecimals!: number;

  @ApiProperty({ example: 'BOB' })
  currency!: string;

  @ApiProperty({ example: 'bo_bank_transfer' })
  rail!: string;

  @ApiProperty({ example: '12.1' })
  price!: string;

  @ApiProperty({
    example: '1210.00',
    description: 'The local money that changes hands.',
  })
  fiatAmount!: string;

  @ApiProperty({
    example: '100000000',
    description: 'Base units the order locks.',
  })
  tokenAmount!: string;

  @ApiProperty({
    example: '99500000',
    description: 'Base units its buyer receives after fees.',
  })
  netAmount!: string;

  @ApiProperty({ example: 50 })
  protocolFeeBps!: number;

  @ApiProperty({ example: 0 })
  integratorFeeBps!: number;

  @ApiProperty({
    example: '0',
    description: 'The merchant’s bond, base units (sales and payouts).',
  })
  bond!: string;

  @ApiProperty({ example: 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI' })
  sellerAddress!: string;

  @ApiProperty({ example: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ' })
  buyerAddress!: string;

  @ApiProperty({ type: OrderMerchantView })
  merchant!: OrderMerchantView;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '7',
    description: 'The order id in the contract, once indexed.',
  })
  onchainId!: string | null;

  @ApiProperty({ type: Date, nullable: true, example: null })
  acceptDeadline!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-19T12:31:00.000Z',
  })
  paymentDeadline!: Date | null;

  @ApiProperty({ type: Date, nullable: true, example: null })
  paidAt!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: null,
    description:
      'When the settle window of a paid order closes: after it anyone may release the order, and the seller’s side can no longer dispute it. Null without a settle window, or before the order is paid.',
  })
  settleDeadline!: Date | null;

  @ApiProperty({ type: Date, nullable: true, example: null })
  endedAt!: Date | null;

  @ApiProperty({ type: OrderTxHashesView })
  txHashes!: OrderTxHashesView;

  @ApiProperty({ type: OrderSettlementView, nullable: true })
  settlement!: OrderSettlementView | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'TRX-88213',
    description: 'The transfer reference reported with the payment.',
  })
  paidReference!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Why a `failed` order never opened.',
  })
  failureReason!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  chargeId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  payoutBatchId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'order-881' })
  externalReference!: string | null;

  @ApiProperty({
    type: PaymentDetailsView,
    nullable: true,
    description:
      'Where the person pays the local money: the merchant’s account, on a purchase or a charge while it is live. Null otherwise.',
  })
  paymentDetails!: PaymentDetailsView | null;

  @ApiProperty({
    type: QrSummaryView,
    nullable: true,
    description: 'A QR payment’s scanned QR, as its payer reads it (one order, not lists).',
  })
  qr!: QrSummaryView | null;

  @ApiProperty({
    type: OrderChatSummaryView,
    description: 'The order’s chat with its merchant (`…/orders/{id}/messages`).',
  })
  chat!: OrderChatSummaryView;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  updatedAt!: Date;
}

/** `POST /v1/p2p/orders`: the order, and for a sale the transaction to sign. */
@ApiSchema({
  description:
    'A new order. A sale (`SELL`) or a QR payment (`QR_PAY`) also carries the one transaction the seller’s wallet signs: `open_with_deposit`, whose token pull into the market is authorised by the same signature (no approval).',
})
export class CreatedOrderView extends OrderView {
  @ApiProperty({
    type: [TransactionView],
    description: 'Empty except on a sale or a QR payment still waiting for its signature.',
  })
  transactions!: TransactionView[];
}

@ApiSchema({ description: 'A page of orders.' })
export class OrderListView {
  @ApiProperty({ type: [OrderView] })
  data!: OrderView[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  take!: number;

  @ApiProperty({ example: 0 })
  skip!: number;
}

@ApiSchema({
  description: 'Who says they paid: shown to the merchant of a live purchase or charge.',
})
export class PayerView {
  @ApiProperty({ example: 'Juan Gómez' })
  name!: string;

  @ApiProperty({ example: '20123456786' })
  document!: string;
}

@ApiSchema({
  description:
    'Where the merchant pays the local money on a sale or a payout, shown to that merchant while it is live.',
})
export class BeneficiaryView {
  @ApiProperty({ example: 'Ana López' })
  holderName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '27234567891',
    description:
      'The holder’s ID number; null where the rail’s transfer does not need it and none was given.',
  })
  document!: string | null;

  @ApiProperty({ example: 'bo_bank_transfer' })
  rail!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { bank: 'Banco Unión', accountType: 'savings', accountNumber: '1000023456781' },
  })
  details!: Record<string, string>;
}

/** An order as its merchant reads it. */
@ApiSchema({
  description:
    'A P2P order as its merchant sees it: the payer’s identity on a live purchase or charge (check the transfer comes from that person), the beneficiary’s account on a live sale or payout (where to pay). Nothing about the client that created it.',
})
export class MerchantOrderView {
  @ApiProperty({ example: '3f1c2b7e-8d4a-4c1e-9b2f-6a5d4c3b2a10' })
  id!: string;

  @ApiProperty({ enum: ['BUY', 'SELL', 'QR_PAY', 'CHARGE', 'PAYOUT'], example: 'BUY' })
  kind!: string;

  @ApiProperty({ enum: STATUSES, example: 'paid' })
  status!: string;

  @ApiProperty({ enum: ['live', 'test'], example: 'test' })
  tier!: string;

  @ApiProperty({ example: 'testnet' })
  network!: string;

  @ApiProperty({ example: 'CAKGHC55HFGIGFDRKKLH7MYLVXE5ELAO57VE2VUCDXBWDVFNDIXXZTJ7' })
  contract!: string;

  @ApiProperty({
    example: 'cm3p2pacc0001l70g8v5q3z2w',
    type: String,
    nullable: true,
  })
  merchantAccountId!: string | null;

  @ApiProperty({
    enum: ['seller', 'buyer'],
    example: 'seller',
    description:
      'The merchant’s side: seller on purchases and charges (it releases), buyer on sales, QR payments and payouts (it accepts and pays).',
  })
  merchantSide!: string;

  @ApiProperty({ example: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA' })
  token!: string;

  @ApiProperty({ example: 'USDC' })
  tokenSymbol!: string;

  @ApiProperty({ example: 7 })
  tokenDecimals!: number;

  @ApiProperty({ example: 'BOB' })
  currency!: string;

  @ApiProperty({ example: 'bo_bank_transfer' })
  rail!: string;

  @ApiProperty({ example: '12.1' })
  price!: string;

  @ApiProperty({ example: '1210.00' })
  fiatAmount!: string;

  @ApiProperty({ example: '100000000' })
  tokenAmount!: string;

  @ApiProperty({ example: '99500000' })
  netAmount!: string;

  @ApiProperty({ example: '0' })
  bond!: string;

  @ApiProperty({ example: 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI' })
  sellerAddress!: string;

  @ApiProperty({ example: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ' })
  buyerAddress!: string;

  @ApiProperty({ type: String, nullable: true, example: '7' })
  onchainId!: string | null;

  @ApiProperty({ type: Date, nullable: true, example: null })
  acceptDeadline!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-19T12:31:00.000Z',
  })
  paymentDeadline!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-19T12:12:40.000Z',
  })
  paidAt!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: null,
    description:
      'When the settle window of a paid order closes: after it anyone may release the order, and the seller’s side can no longer dispute it. Null without a settle window, or before the order is paid.',
  })
  settleDeadline!: Date | null;

  @ApiProperty({ type: Date, nullable: true, example: null })
  endedAt!: Date | null;

  @ApiProperty({ type: OrderTxHashesView })
  txHashes!: OrderTxHashesView;

  @ApiProperty({ type: OrderSettlementView, nullable: true })
  settlement!: OrderSettlementView | null;

  @ApiProperty({ type: String, nullable: true, example: 'TRX-88213' })
  paidReference!: string | null;

  @ApiProperty({ type: PayerView, nullable: true })
  payer!: PayerView | null;

  @ApiProperty({ type: BeneficiaryView, nullable: true })
  beneficiary!: BeneficiaryView | null;

  @ApiProperty({
    type: MerchantQrView,
    nullable: true,
    description: 'A live QR payment’s QR: what the merchant pays. Null otherwise.',
  })
  qr!: MerchantQrView | null;

  @ApiProperty({
    type: OrderChatSummaryView,
    description:
      'The order’s chat with the side that created it (`/v1/p2p/merchant/orders/{id}/messages`).',
  })
  chat!: OrderChatSummaryView;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  updatedAt!: Date;
}

@ApiSchema({ description: 'A page of the merchant’s orders.' })
export class MerchantOrderListView {
  @ApiProperty({ type: [MerchantOrderView] })
  data!: MerchantOrderView[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  take!: number;

  @ApiProperty({ example: 0 })
  skip!: number;
}

@ApiSchema({
  description:
    'An order an incoming bank transfer most likely settles, with its release ready to sign.',
})
export class TransferMatchView {
  @ApiProperty({ type: MerchantOrderView })
  order!: MerchantOrderView;

  @ApiProperty({
    example: 3,
    description:
      '1 for the exact amount and currency, plus 1 for a matching payer name and 1 for a matching document.',
  })
  score!: number;

  @ApiProperty({ type: [String], example: ['amount', 'name', 'document'] })
  matchedOn!: string[];

  @ApiProperty({
    type: TransactionView,
    description:
      '`release` for the order, prepared with the merchant account as source and acting address: the merchant’s key (or its bot holding it) signs it and submits it (`POST /v1/p2p/submit`).',
  })
  transaction!: TransactionView;
}

@ApiSchema({ description: 'Orders a transfer may settle, best first.' })
export class TransferMatchListView {
  @ApiProperty({ type: [TransferMatchView] })
  data!: TransferMatchView[];
}
