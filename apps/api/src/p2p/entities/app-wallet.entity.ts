import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { OrderView } from '@/p2p/entities/order.entity';
import { TransactionView } from '@/p2p/entities/transaction.entity';

const G = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';
const G2 = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';
const SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const HASH = '6b1f8c3e2d7a4b5c9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f';

@ApiSchema({ name: 'AppProfile', description: 'Your account and its @handle.' })
export class ProfileView {
  @ApiProperty({ example: G })
  address!: string;

  @ApiProperty({ type: String, nullable: true, example: 'maria_flores' })
  handle!: string | null;
}

@ApiSchema({ name: 'AppHandle', description: 'Who an @handle is.' })
export class HandleView {
  @ApiProperty({ example: 'maria_flores' })
  handle!: string;

  @ApiProperty({ example: G })
  address!: string;
}

@ApiSchema({ name: 'AppAccountState', description: 'Whether the account exists on the network.' })
export class AccountStateView {
  @ApiProperty({ example: true })
  exists!: boolean;
}

@ApiSchema({
  name: 'AppTokenBalance',
  description: 'One token the market lists, as the account holds it.',
})
export class TokenBalanceView {
  @ApiProperty({ example: 'USDC' })
  symbol!: string;

  @ApiProperty({ example: SAC, description: 'Its Stellar Asset Contract.' })
  contract!: string;

  @ApiProperty({
    example: '125000000',
    description:
      'Base units (7 decimals); 0 without a trustline. For the native lumen (`XLM`): the SPENDABLE lumens, the balance less the reserves the account pays itself (sponsored ones excluded) and its selling liabilities.',
  })
  amount!: string;

  @ApiProperty({
    example: true,
    description:
      'Whether the account has a trustline to it. Always true for the native lumen, which needs none.',
  })
  trustline!: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether the issuer authorised that trustline. Always true for the native lumen.',
  })
  authorized!: boolean;
}

@ApiSchema({ name: 'AppBalances', description: 'Your balances on one network.' })
export class BalancesView {
  @ApiProperty({ example: 'testnet' })
  network!: string;

  @ApiProperty({ type: AccountStateView })
  account!: AccountStateView;

  @ApiProperty({
    example: '0',
    description:
      'The whole lumen balance, stroops, reserves included (fees are sponsored: usually 0). What can be sent is the `XLM` entry of `tokens`, when the market lists it.',
  })
  xlm!: string;

  @ApiProperty({ type: [TokenBalanceView] })
  tokens!: TokenBalanceView[];
}

@ApiSchema({ name: 'AppActivation', description: 'The sponsored activation to sign, if any.' })
export class ActivationView {
  @ApiProperty({
    type: TransactionView,
    nullable: true,
    description:
      'Null when there is nothing to do. When the account is missing its source is the sponsor (a missing account has no sequence number); the API adds the sponsor’s signature at submit.',
  })
  transaction!: TransactionView | null;
}

@ApiSchema({ name: 'AppTransfer', description: 'A token transfer between wallets.' })
export class TransferView {
  @ApiProperty({ example: '0b6c9a3e-2f1d-4c5b-8a7e-6d5c4b3a2f10' })
  id!: string;

  @ApiProperty({ example: 'testnet' })
  network!: string;

  @ApiProperty({ example: 'USDC', description: 'The token’s symbol.' })
  token!: string;

  @ApiProperty({ example: SAC, description: 'The token’s Stellar Asset Contract.' })
  tokenContract!: string;

  @ApiProperty({ example: '25000000', description: 'Base units (7 decimals).' })
  amount!: string;

  @ApiProperty({ example: G })
  from!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Null for a payment from outside the app, or a sender without a handle.',
  })
  fromHandle!: string | null;

  @ApiProperty({ example: G2, description: 'As sent to: a G, M or C address.' })
  to!: string;

  @ApiProperty({ type: String, nullable: true, example: 'maria_flores' })
  toHandle!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Empanadas' })
  note!: string | null;

  @ApiProperty({ enum: ['in', 'out'], example: 'out', description: 'From your side.' })
  direction!: string;

  @ApiProperty({ enum: ['PENDING', 'SUBMITTED', 'COMPLETED', 'FAILED'], example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ type: String, nullable: true, example: HASH })
  hash!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  completedAt!: Date | null;
}

@ApiSchema({ name: 'AppCreatedTransfer', description: 'A transfer and the transaction to sign.' })
export class CreatedTransferView {
  @ApiProperty({ type: TransferView })
  transfer!: TransferView;

  @ApiProperty({
    type: TransactionView,
    description:
      'A classic `payment` to a G or M recipient, a SAC `transfer` to a C recipient; the note is its text memo. The native lumen (`XLM`) always moves through its SAC `transfer` (the note then stays off-chain).',
  })
  transaction!: TransactionView;
}

@ApiSchema({
  name: 'AppActivityItem',
  description: 'One line of your activity: an order (`order`) or a transfer (`transfer`).',
})
export class ActivityItemView {
  @ApiProperty({ enum: ['order', 'transfer'], example: 'transfer' })
  type!: string;

  @ApiProperty({ description: 'When it happened (its creation).' })
  at!: Date;

  @ApiProperty({ type: OrderView, required: false })
  order?: OrderView;

  @ApiProperty({ type: TransferView, required: false })
  transfer?: TransferView;
}

@ApiSchema({ name: 'AppActivity', description: 'Your activity, newest first.' })
export class ActivityView {
  @ApiProperty({ type: [ActivityItemView] })
  items!: ActivityItemView[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass it as `cursor` for the next page.',
  })
  nextCursor!: string | null;
}

@ApiSchema({
  name: 'AppPayWithBalance',
  description: 'What paying a charge from your balance costs now.',
})
export class PayWithBalanceView {
  @ApiProperty({ example: 'USDC' })
  token!: string;

  @ApiProperty({ example: SAC })
  tokenContract!: string;

  @ApiProperty({
    example: '199500000',
    description: 'Base units: what the business would have received, at the current best quote.',
  })
  amount!: string;

  @ApiProperty({ example: G2, description: 'The account (G) or contract (C) the payment goes to.' })
  recipient!: string;

  @ApiProperty({ description: 'The price holds until then (60 s).' })
  expiresAt!: Date;
}

@ApiSchema({ name: 'AppCharge', description: 'A charge as its payer sees it.' })
export class AppChargeView {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'testnet' }) network!: string;
  @ApiProperty({ example: 'USDC' }) tokenSymbol!: string;
  @ApiProperty({ example: 'BOB' }) currency!: string;
  @ApiProperty({ example: '25000.00' }) fiatAmount!: string;
  @ApiProperty({ example: 'Tienda Mamoré', description: 'Who charges.' })
  merchantName!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: ['open', 'paid', 'cancelled', 'expired'] }) status!: string;
  @ApiProperty({ type: [String], description: 'Rails the local-money checkout offers now.' })
  rails!: string[];
  @ApiProperty() expiresAt!: Date;

  @ApiProperty({
    type: PayWithBalanceView,
    nullable: true,
    description: 'Null when the charge is not open or no quote prices it now.',
  })
  payWithBalance!: PayWithBalanceView | null;
}

@ApiSchema({ name: 'AppChargePayment', description: 'A charge paid from a wallet’s balance.' })
export class ChargePaymentView {
  @ApiProperty() id!: string;
  @ApiProperty() chargeId!: string;
  @ApiProperty({ example: 'testnet' }) network!: string;
  @ApiProperty({ example: 'USDC' }) token!: string;
  @ApiProperty({ example: SAC }) tokenContract!: string;
  @ApiProperty({ example: '199500000' }) amount!: string;
  @ApiProperty({ enum: ['PENDING', 'SUBMITTED', 'COMPLETED', 'FAILED', 'EXPIRED'] })
  status!: string;
  @ApiProperty({ example: HASH }) hash!: string;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) completedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}

@ApiSchema({
  name: 'AppCreatedChargePayment',
  description: 'A charge payment and the transaction to sign.',
})
export class CreatedChargePaymentView {
  @ApiProperty({ type: ChargePaymentView })
  payment!: ChargePaymentView;

  @ApiProperty({
    type: TransactionView,
    description: 'The token transfer to the charge’s receiving account; it expires with the price.',
  })
  transaction!: TransactionView;
}

@ApiSchema({
  name: 'Submission',
  description:
    'A signed transaction the API submitted (fee-bumped by its sponsor when gasless is on).',
})
export class SubmissionView {
  @ApiProperty({ example: HASH, description: 'The inner transaction’s hash.' })
  hash!: string;

  @ApiProperty({ example: 'testnet' })
  network!: string;

  @ApiProperty({ enum: ['PENDING', 'SUCCESS', 'FAILED'], example: 'SUCCESS' })
  status!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Why it failed.' })
  error!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The sponsor’s fee-bump hash.' })
  feeBumpHash!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'The ledger it was applied in.' })
  ledger!: number | null;

  @ApiProperty({ description: 'Whether the sponsor paid its fee.' })
  sponsored!: boolean;
}
