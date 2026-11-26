import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MerchantStatsView } from '@/p2p/entities/account.entity';
import { QrSummaryView } from '@/p2p/entities/order.entity';

@ApiSchema({
  description:
    "A merchant's standing price on one network, token, currency and side. A price older than `priceTtlSeconds` is not matched until it is refreshed.",
})
export class OfferView {
  @ApiProperty({ example: 'cm3p2poff0001l70g8v5q3z2w' })
  id!: string;

  @ApiProperty({
    example: 'cm3p2pacc0001l70g8v5q3z2w',
    description: 'The merchant account.',
  })
  accountId!: string;

  @ApiProperty({
    enum: ['SELL_TOKEN', 'BUY_TOKEN'],
    example: 'SELL_TOKEN',
    description:
      'SELL_TOKEN: the merchant sells tokens (people buy them). BUY_TOKEN: the merchant buys tokens (people sell them, clients pay out).',
  })
  side!: string;

  @ApiProperty({ example: 'testnet' })
  network!: string;

  @ApiProperty({ example: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA' })
  token!: string;

  @ApiProperty({ example: 'USDC' })
  tokenSymbol!: string;

  @ApiProperty({ example: 'BOB' })
  currency!: string;

  @ApiProperty({ type: [String], example: ['bo_bank_transfer'] })
  rails!: string[];

  @ApiProperty({ example: '12.1', description: 'Local money per one token.' })
  price!: string;

  @ApiProperty({ example: '2026-11-19T12:00:00.000Z' })
  priceUpdatedAt!: Date;

  @ApiProperty({ example: 600 })
  priceTtlSeconds!: number;

  @ApiProperty({
    example: true,
    description: 'Whether the price is still within its lifetime, so the offer can be matched.',
  })
  priceFresh!: boolean;

  @ApiProperty({ example: '5000', description: 'Smallest order, local money.' })
  minFiat!: string;

  @ApiProperty({
    example: '500000',
    description: 'Largest order, local money.',
  })
  maxFiat!: string;

  @ApiProperty({ example: true })
  active!: boolean;

  @ApiProperty({ example: '2026-11-19T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-19T12:00:00.000Z' })
  updatedAt!: Date;
}

@ApiSchema({ description: 'A page of offers.' })
export class OfferListView {
  @ApiProperty({ type: [OfferView] })
  data!: OfferView[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  take!: number;

  @ApiProperty({ example: 0 })
  skip!: number;
}

@ApiSchema({
  description:
    'The merchant a quote matched, as people see it: a name and a track record, never its address or accounts.',
})
export class QuoteMerchantView extends MerchantStatsView {
  @ApiProperty({ example: 'Oriente Cambio' })
  displayName!: string;
}

@ApiSchema({ description: 'Seconds each step of the order will have.' })
export class OrderWindowsView {
  @ApiProperty({
    example: 0,
    description: 'To accept (orders with a bond only).',
  })
  acceptWindow!: number;

  @ApiProperty({
    example: 1800,
    description: 'To pay the local money and report it.',
  })
  paymentWindow!: number;

  @ApiProperty({
    example: 0,
    description:
      'After a reported payment with no dispute, before anyone may release it; 0 = never on its own.',
  })
  settleWindow!: number;
}

/** `POST /v1/p2p/quotes`. */
@ApiSchema({
  description:
    'A firm price for one minute: the merchant that will take the order, the amounts and the fees. Create the order from it with `POST /v1/p2p/orders`.',
})
export class QuoteView {
  @ApiProperty({ example: 'cm3p2pqte0001l70g8v5q3z2w' })
  id!: string;

  @ApiProperty({
    enum: ['BUY', 'SELL'],
    example: 'BUY',
    description:
      'The person’s side: BUY receives tokens for local money, SELL sends tokens for it (a QR payment is a SELL).',
  })
  side!: string;

  @ApiProperty({
    enum: ['BUY', 'SELL', 'QR_PAY'],
    example: 'BUY',
    description: 'The order kind the quote is for: its side, or `QR_PAY` for a scanned QR.',
  })
  kind!: string;

  @ApiProperty({
    type: QrSummaryView,
    nullable: true,
    description: 'A QR payment’s scanned QR (merchant, city, amount); null otherwise.',
  })
  qr!: QrSummaryView | null;

  @ApiProperty({ example: 'testnet' })
  network!: string;

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

  @ApiProperty({ example: '12.1', description: 'Local money per one token.' })
  price!: string;

  @ApiProperty({
    example: '1210.00',
    description: 'BUY: what the person pays. SELL: what the person receives.',
  })
  fiatAmount!: string;

  @ApiProperty({
    example: '100000000',
    description: 'Base units the order locks (gross).',
  })
  tokenAmount!: string;

  @ApiProperty({
    example: '99500000',
    description:
      'Base units the buyer of the tokens receives after fees: the person on a BUY, the merchant on a SELL.',
  })
  netAmount!: string;

  @ApiProperty({ example: 50 })
  protocolFeeBps!: number;

  @ApiProperty({ example: '500000', description: 'Base units.' })
  protocolFee!: string;

  @ApiProperty({ example: 0 })
  integratorFeeBps!: number;

  @ApiProperty({
    example: '0',
    description: 'Base units, paid to your registered wallet.',
  })
  integratorFee!: string;

  @ApiProperty({
    example: '0',
    description: 'SELL: the merchant’s bond, base units, locked when it accepts. 0 on a BUY.',
  })
  bond!: string;

  @ApiProperty({ type: OrderWindowsView })
  windows!: OrderWindowsView;

  @ApiProperty({ type: QuoteMerchantView })
  merchant!: QuoteMerchantView;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  expiresAt!: Date;
}
