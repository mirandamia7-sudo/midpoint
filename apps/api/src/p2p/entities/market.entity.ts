import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({
  description:
    'A token the P2P market trades on one network, used on-chain through its Stellar Asset Contract: a classic Stellar asset (a stablecoin such as USDC), or the native lumen (`XLM`, `issuer: null`, no trustline needed).',
})
export class TokenView {
  @ApiProperty({ example: 'USDC', description: 'Its symbol.' })
  symbol!: string;

  @ApiProperty({ example: 'USDC', description: 'The asset code (`XLM` for the native lumen).' })
  code!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    description: 'The issuing account (G...); null only for the native lumen (`XLM`).',
  })
  issuer!: string | null;

  @ApiProperty({
    example: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    description: 'Its Stellar Asset Contract (C...): what orders and balances name it by.',
  })
  contract!: string;

  @ApiProperty({ example: 7, description: 'Decimal places of its base units (always 7).' })
  decimals!: number;
}

@ApiSchema({
  description:
    'One Stellar network the P2P market runs on: where the contract is, and what it trades.',
})
export class NetworkView {
  @ApiProperty({
    example: 'testnet',
    enum: ['local', 'testnet', 'mainnet'],
    description: 'The network id requests use (`network`).',
  })
  id!: string;

  @ApiProperty({ example: 'Stellar Testnet', description: 'Its name, for a picker.' })
  name!: string;

  @ApiProperty({
    example: 'Test SDF Network ; September 2015',
    description: 'Its network passphrase: what transactions are signed for.',
  })
  networkPassphrase!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://soroban-testnet.stellar.org',
    description: 'A PUBLIC Soroban RPC endpoint; never the node this service reads through.',
  })
  rpcUrl!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://horizon-testnet.stellar.org',
    description: 'A public Horizon endpoint, or null.',
  })
  horizonUrl!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://stellar.expert/explorer/testnet',
    description:
      'A stellar.expert-style explorer: append `/tx/<hash>`, `/account/<G...>` or `/contract/<C...>`. Null when there is none.',
  })
  explorerUrl!: string | null;

  @ApiProperty({
    example: 'CAKGHC55HFGIGFDRKKLH7MYLVXE5ELAO57VE2VUCDXBWDVFNDIXXZTJ7',
    description:
      "The P2P market contract (C...): where balances are deposited and orders lock tokens. Verified against this service's build (its wasm hash) before it is listed.",
  })
  contract!: string;

  @ApiProperty({
    example: 50,
    description:
      'The protocol fee, basis points of every payment to a buyer, as the contract charges it now. Each order keeps the rate it was opened with.',
  })
  protocolFeeBps!: number;

  @ApiProperty({
    example: false,
    description:
      'Whether the contract is paused: no new deposits, orders or acceptances, while every withdrawal, release, cancellation and dispute still works.',
  })
  paused!: boolean;

  @ApiProperty({ type: [TokenView] })
  tokens!: TokenView[];
}

@ApiSchema({ description: 'Whether the API pays network fees and reserves for wallets.' })
export class SponsorView {
  @ApiProperty({
    example: true,
    description:
      'True: `POST /v1/app/submit` and `/v1/p2p/submit` fee-bump signed transactions with the sponsor account, and activations are sponsored. False: transactions are submitted as signed (the wallet pays its fee).',
  })
  enabled!: boolean;
}

@ApiSchema({ description: 'One field of a payment rail’s account details.' })
export class RailFieldView {
  @ApiProperty({ example: 'accountNumber', description: 'The key in `details`.' })
  name!: string;

  @ApiProperty({
    example: 'Account number, 6 to 20 digits',
    description: 'What it holds, in English.',
  })
  description!: string;

  @ApiProperty({
    example: false,
    description: 'Whether a merchant’s payment method (`/v1/p2p/payment-methods`) must give it.',
  })
  required!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether an order’s beneficiary (a sale’s, a payout’s) must give it: as `required`, but the holder’s ID only where the rail’s transfer needs it.',
  })
  beneficiaryRequired!: boolean;

  @ApiProperty({
    type: [String],
    required: false,
    example: ['savings', 'checking'],
    description: 'The values it takes, when it is a choice.',
  })
  options?: string[];
}

@ApiSchema({ description: 'A local payment rail and the details it needs.' })
export class RailView {
  @ApiProperty({
    example: 'bo_bank_transfer',
    description: 'The rail id requests use.',
  })
  id!: string;

  @ApiProperty({
    example: 'Bank transfer',
    description: 'Its name, in English.',
  })
  name!: string;

  @ApiProperty({
    enum: ['account', 'qr'],
    example: 'account',
    description:
      '`account`: the local money goes to an account (the fields below). `qr`: the rail pays a scanned merchant QR (`QR_PAY` orders); it takes no fields.',
  })
  kind!: string;

  @ApiProperty({ type: [RailFieldView] })
  fields!: RailFieldView[];

  @ApiProperty({
    example: false,
    description:
      'Whether an order’s beneficiary must give the holder’s ID (the beneficiary’s `document` and the ID fields): true only where the transfer system needs it (Chile, Colombia).',
  })
  beneficiaryIdRequired!: boolean;
}

@ApiSchema({
  description: 'A local currency the market prices, with its rails.',
})
export class CurrencyView {
  @ApiProperty({ example: 'BOB', description: 'ISO 4217 code.' })
  code!: string;

  @ApiProperty({
    example: 2,
    description: 'Decimal places an amount in it may carry.',
  })
  decimals!: number;

  @ApiProperty({ type: [RailView] })
  rails!: RailView[];
}

@ApiSchema({ description: 'Seconds each step of an order may take, per kind.' })
export class WindowsView {
  @ApiProperty({
    example: 1800,
    description: 'A purchase or a charge: seconds to pay the merchant.',
  })
  buyPaymentWindow!: number;

  @ApiProperty({
    example: 300,
    description: 'A sale or a payout: seconds the merchant has to accept it (locking its bond).',
  })
  sellAcceptWindow!: number;

  @ApiProperty({
    example: 1800,
    description: 'A sale or a payout: seconds the merchant then has to pay.',
  })
  sellPaymentWindow!: number;

  @ApiProperty({
    example: 21600,
    description:
      'A sale: seconds after the merchant marked it paid with no dispute before anyone may release it. A payout gets it only when the client enabled `autoSettle` for the matcher.',
  })
  sellSettleWindow!: number;

  @ApiProperty({
    example: 120,
    description: 'A QR payment: seconds the merchant has to accept it.',
  })
  qrAcceptWindow!: number;

  @ApiProperty({
    example: 600,
    description: 'A QR payment: seconds the merchant then has to pay the scanned QR.',
  })
  qrPaymentWindow!: number;

  @ApiProperty({
    example: 3600,
    description:
      'A QR payment: seconds after the merchant marked it paid with no dispute before anyone may release it.',
  })
  qrSettleWindow!: number;
}

/** `GET /v1/p2p/market`. */
@ApiSchema({
  description:
    'The P2P market for this API key: the networks it runs on, their contracts and tokens, the currencies and rails, the fee, the windows and the matcher to authorise.',
})
export class MarketOverviewView {
  @ApiProperty({
    enum: ['live', 'test'],
    example: 'test',
    description: "The tier the API key's environment selects (`prod`: public).",
  })
  tier!: string;

  @ApiProperty({
    example: true,
    description: 'Whether the market runs on at least one network for this key.',
  })
  available!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'GAXTHY6ASJEWI3OJGM7UZ2KSMBQD7VHCCH27PAL6ALSSSW7D33B5WMMI',
    description:
      "The matcher account: what a seller authorises with `set_matcher` so purchases and payouts open on its balance. It can open orders within the cap the seller sets and act for a buyer it opened an order for; it can never withdraw or release a seller's tokens.",
  })
  matcher!: string | null;

  @ApiProperty({ type: SponsorView })
  sponsor!: SponsorView;

  @ApiProperty({
    example: 1000,
    description: "The merchant's bond on a sale or a payout, basis points of the amount.",
  })
  bondBps!: number;

  @ApiProperty({
    example: 500,
    description: 'The most an integrator may charge per order, basis points.',
  })
  maxIntegratorFeeBps!: number;

  @ApiProperty({ type: WindowsView })
  windows!: WindowsView;

  @ApiProperty({ type: [NetworkView] })
  networks!: NetworkView[];

  @ApiProperty({ type: [CurrencyView] })
  currencies!: CurrencyView[];
}
