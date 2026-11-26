import { ApiProperty, ApiPropertyOptional, ApiSchema, OmitType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NETWORK_IDS } from '@/chain/networks';
import { P2P_CURRENCY_CODES } from '@/p2p/domain/constants';
import { P2P_RAIL_IDS } from '@/p2p/domain/rails';
import { CreateOrderDto } from '@/p2p/dto/order.dto';

/** The longest QR payload accepted (EMV allows 512 characters). */
const QR_MAX = 512;

/**
 * The public app's quote: a BUY or SELL trade (as `POST /v1/p2p/quotes`,
 * with no integrator fields: the app sets its own), or a QR payment
 * (`kind: 'QR_PAY'` with the scanned `qr`).
 */
@ApiSchema({
  name: 'AppQuote',
  description:
    'What the signed-in wallet wants to do. A trade: `side`, `network`, `token`, `currency`, `rail` and one of `fiatAmount` or `tokenAmount`. A QR payment: `kind: QR_PAY`, `network`, `token`, `qr` and, when the QR carries no amount, `fiatAmount` (the currency and rail come from the QR).',
})
export class AppQuoteDto {
  @ApiPropertyOptional({
    enum: ['BUY', 'SELL', 'QR_PAY'],
    example: 'QR_PAY',
    description: 'Omitted: the trade `side` says it. `QR_PAY`: pay a scanned merchant QR.',
  })
  @IsOptional()
  @IsIn(['BUY', 'SELL', 'QR_PAY'])
  kind?: 'BUY' | 'SELL' | 'QR_PAY';

  @ApiPropertyOptional({
    enum: ['BUY', 'SELL'],
    example: 'BUY',
    description:
      'A trade: BUY receives tokens and pays local money; SELL sends tokens and receives local money. Required unless `kind` is `QR_PAY`.',
  })
  @IsOptional()
  @IsIn(['BUY', 'SELL'])
  side?: 'BUY' | 'SELL';

  @ApiProperty({ enum: NETWORK_IDS, example: 'testnet' })
  @IsIn(NETWORK_IDS)
  network!: string;

  @ApiProperty({ example: 'USDC', description: 'By symbol, contract (C...) or CODE:ISSUER.' })
  @IsString()
  @MaxLength(70)
  token!: string;

  @ApiPropertyOptional({ enum: P2P_CURRENCY_CODES, example: 'BOB', description: 'A trade only.' })
  @IsOptional()
  @IsIn(P2P_CURRENCY_CODES)
  currency?: string;

  @ApiPropertyOptional({
    enum: P2P_RAIL_IDS,
    example: 'bo_bank_transfer',
    description: 'A trade only.',
  })
  @IsOptional()
  @IsIn(P2P_RAIL_IDS)
  rail?: string;

  @ApiPropertyOptional({
    example: '1210',
    description:
      'Local money. A trade: what the person pays (BUY) or receives (SELL). A QR payment: what the shop gets, required when the QR carries no amount and equal to it when it does.',
  })
  @IsOptional()
  @Matches(/^\d{1,15}(\.\d{1,2})?$/, { message: 'fiatAmount must be a positive decimal' })
  fiatAmount?: string;

  @ApiPropertyOptional({
    example: '1000000000',
    description: 'A trade only: the token amount the order locks, base units.',
  })
  @IsOptional()
  @Matches(/^[1-9]\d{0,37}$/, { message: 'tokenAmount must be a positive integer in base units' })
  tokenAmount?: string;

  @ApiPropertyOptional({
    example: '0002010102123944Zm9vYmFy...6304ABCD',
    description:
      'A QR payment: the scanned merchant QR exactly as read (Peru’s interoperable QR of Yape, Plin and the banks, Brazil’s PIX, or Argentina’s interoperable QR). Its CRC must check. A static QR carries no amount: give `fiatAmount`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(QR_MAX)
  qr?: string;
}

/**
 * The public app's order from its quote. The wallet is always the signed-in
 * one: a purchase delivers to it, a sale or a QR payment is signed by it.
 */
@ApiSchema({
  name: 'AppOrder',
  description:
    'An order from your quote. A purchase (BUY) needs `payer`; a sale (SELL) needs `beneficiary`; a QR payment (`kind: QR_PAY`) needs the same `qr` its quote was made for.',
})
export class AppOrderDto extends OmitType(CreateOrderDto, [
  'recipient',
  'seller',
  'kind',
] as const) {
  @ApiPropertyOptional({
    enum: ['BUY', 'SELL', 'QR_PAY'],
    example: 'QR_PAY',
    description: 'Optional; when given it must be the quote’s kind.',
  })
  @IsOptional()
  @IsIn(['BUY', 'SELL', 'QR_PAY'])
  kind?: 'BUY' | 'SELL' | 'QR_PAY';

  @ApiPropertyOptional({
    description: 'A QR payment: the scanned QR, exactly as quoted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(QR_MAX)
  qr?: string;
}

export const APP_TRANSACTION_ACTIONS = [
  'open',
  'accept',
  'markPaid',
  'release',
  'cancel',
  'dispute',
] as const;

@ApiSchema({
  name: 'AppTransaction',
  description: 'An action your own wallet signs on your order.',
})
export class AppTransactionDto {
  @ApiProperty({
    enum: APP_TRANSACTION_ACTIONS,
    example: 'release',
    description:
      'Usually `release` (a sale or QR payment you were paid for), `dispute` or `cancel`; `open` is a pending sale or QR payment’s `open_with_deposit`, simulated now (ask for it right before signing: one simulated earlier can go stale when another order takes the order id it names). Refused when your wallet may not do it now.',
  })
  @IsIn(APP_TRANSACTION_ACTIONS)
  action!: (typeof APP_TRANSACTION_ACTIONS)[number];
}
