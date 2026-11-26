import { ApiProperty, ApiSchema } from '@nestjs/swagger';

const ADDRESS = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';

@ApiSchema({
  description:
    'A registration challenge: a SEP-10-shaped transaction the account signs (it is never submitted). Besides the single-use nonce and `web_auth_domain`, its `organization` entry names your organization and tier, so it registers nothing else. Sign it once, before `expiresAt`.',
})
export class ChallengeView {
  @ApiProperty({ description: 'The challenge transaction envelope, base64 XDR.' })
  transaction!: string;

  @ApiProperty({ example: 'Test SDF Network ; September 2015' })
  network_passphrase!: string;

  @ApiProperty({ example: '2026-11-19T12:10:00.000Z' })
  expiresAt!: Date;
}

@ApiSchema({ description: "A merchant's track record, as quotes show it." })
export class MerchantStatsView {
  @ApiProperty({ example: 42, description: 'Orders completed.' })
  completedOrders!: number;

  @ApiProperty({
    example: 1,
    description:
      'Orders it had to act on and did not (a sale it never accepted or paid, an order it cancelled).',
  })
  cancelledOrders!: number;

  @ApiProperty({
    example: 0.97,
    description: 'completed / (completed + cancelled); 0.5 for a merchant with no history yet.',
  })
  completionRate!: number;

  @ApiProperty({
    example: 0,
    description: 'Disputes an arbiter resolved against it.',
  })
  disputesLost!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 95,
    description: 'Median seconds from paid to released, over its recent orders.',
  })
  medianReleaseSeconds!: number | null;
}

@ApiSchema({
  description:
    'A wallet this organization proved it holds, on the key’s tier: what it trades, charges and pays out from.',
})
export class AccountView {
  @ApiProperty({ example: 'cm3p2pacc0001l70g8v5q3z2w' })
  id!: string;

  @ApiProperty({ enum: ['live', 'test'], example: 'test' })
  tier!: string;

  @ApiProperty({
    example: ADDRESS,
    description: 'The wallet, EIP-55. The same on every network.',
  })
  address!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Treasury wallet' })
  label!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Oriente Cambio',
    description:
      'The name people see on a quote when this account is the merchant. Required before it can publish an offer.',
  })
  displayName!: string | null;

  @ApiProperty({
    enum: ['ACTIVE', 'PAUSED', 'SUSPENDED'],
    example: 'ACTIVE',
    description:
      'Whether its offers are matched. You set ACTIVE or PAUSED; SUSPENDED is set by the platform and only the platform lifts it.',
  })
  merchantStatus!: string;

  @ApiProperty({ type: MerchantStatsView })
  stats!: MerchantStatsView;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-19T11:58:02.000Z',
  })
  lastActiveAt!: Date | null;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  verifiedAt!: Date;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  updatedAt!: Date;
}

@ApiSchema({ description: 'A balance an account holds in the contract.' })
export class BalanceView {
  @ApiProperty({ example: 'USDC' })
  symbol!: string;

  @ApiProperty({
    example: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    description: 'The token’s Stellar Asset Contract.',
  })
  token!: string;

  @ApiProperty({
    example: '250000000',
    description: 'Free balance in base units: what new orders can lock and what can be withdrawn.',
  })
  amount!: string;

  @ApiProperty({
    example: '100000000',
    description:
      'Base units locked in live orders: those this account sells in, plus the bonds it locked accepting as a buyer. Derived from this service’s order records (an order opened outside this API is not counted); the free balance above is read from the contract.',
  })
  locked!: string;

  @ApiProperty({ example: 7 })
  decimals!: number;
}

@ApiSchema({
  description: 'What the account allows The matcher on one network.',
})
export class MatcherTermsView {
  @ApiProperty({
    example: '500000000',
    description:
      'The largest order the matcher may open on this balance, base units; 0 = not authorised.',
  })
  maxPerOrder!: string;

  @ApiProperty({
    example: false,
    description:
      'Whether its orders may carry a settle window (silence after a payment releases them).',
  })
  autoSettle!: boolean;
}

@ApiSchema({
  description: 'An account on one network, read live from the contract.',
})
export class AccountNetworkView {
  @ApiProperty({ example: 'testnet' })
  network!: string;

  @ApiProperty({ type: [BalanceView] })
  balances!: BalanceView[];

  @ApiProperty({ type: MatcherTermsView })
  matcher!: MatcherTermsView;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ: 6 },
    description:
      'Operators the market saw this account grant on this network, with their permission bits (1 open, 2 release, 4 trade, 8 withdraw). A grant of 0 is a revocation and is left out.',
  })
  operators!: Record<string, number>;
}

@ApiSchema({
  description: 'An account with its live state on every network the market runs on for this key.',
})
export class AccountDetailView extends AccountView {
  @ApiProperty({
    type: [AccountNetworkView],
    description:
      'One entry per network; a network whose node cannot be read right now is left out.',
  })
  networks!: AccountNetworkView[];
}

@ApiSchema({ description: 'A page of accounts.' })
export class AccountListView {
  @ApiProperty({ type: [AccountView] })
  data!: AccountView[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  take!: number;

  @ApiProperty({ example: 0 })
  skip!: number;
}

@ApiSchema({
  description:
    'Where an account receives local money on one rail. Shown in full to its owner, and to the counterparty of a live order only.',
})
export class PaymentMethodView {
  @ApiProperty({ example: 'cm3p2ppm00001l70g8v5q3z2w' })
  id!: string;

  @ApiProperty({ example: 'cm3p2pacc0001l70g8v5q3z2w' })
  accountId!: string;

  @ApiProperty({ example: 'BOB' })
  currency!: string;

  @ApiProperty({ example: 'bo_bank_transfer' })
  rail!: string;

  @ApiProperty({
    example: 'María Pérez',
    description: 'The account holder, as the bank shows it.',
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
    description: 'The rail’s fields, normalized (`GET /v1/p2p/market` lists them per rail).',
  })
  details!: Record<string, string>;

  @ApiProperty({
    example: 'Banco Unión ••••5678',
    description: 'A short, masked line.',
  })
  summary!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Main account' })
  label!: string | null;

  @ApiProperty({
    example: true,
    description: 'Inactive methods are never shown on an order.',
  })
  active!: boolean;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-19T12:01:00.000Z' })
  updatedAt!: Date;
}

@ApiSchema({ description: 'A page of payment methods.' })
export class PaymentMethodListView {
  @ApiProperty({ type: [PaymentMethodView] })
  data!: PaymentMethodView[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 20 })
  take!: number;

  @ApiProperty({ example: 0 })
  skip!: number;
}
