/* The mock API's starting data, in the API's wire shapes (base units, token contracts, flat
   deadlines), so mock mode exercises the same readers (src/lib/p2p/normalize.ts) as the real API.

   Every key here is derived from a fixed, public seed ("midpoint-mock:<name>"): the demo wallets
   sign real Stellar transactions that only the in-browser mock API ever sees. Nothing points at
   a funded account on any network. */
import { Asset, Keypair, StrKey, hash } from '@stellar/stellar-sdk/base';
import { PASSPHRASES } from '@/lib/stellar/network';

const seed = (name: string) => hash(new TextEncoder().encode(`midpoint-mock:${name}`));

/** A demo key pair: deterministic, test data only. */
export const mockKeypair = (name: string) => Keypair.fromRawEd25519Seed(seed(name));
const account = (name: string) => mockKeypair(name).publicKey();
const contract = (name: string) => StrKey.encodeContract(seed(name));

/** The people the demo wallet can sign in as. */
export const PERSONAS = ['user', 'merchant', 'business', 'fresh'] as const;
export type Persona = (typeof PERSONAS)[number];

export const USER = account('user');
export const MERCHANT_WALLET = account('merchant');
export const BUSINESS_WALLET = account('business');
export const FRESH = account('fresh');
/** Another app user, with a handle, to send money to. */
export const FRIEND = account('friend');
/** The merchant that takes app orders in mock mode (not one of the demo organizations). */
export const OTHER_MERCHANT = account('other-merchant');
export const MATCHER = account('matcher');
export const SPONSOR = account('sponsor');
export const SEP10_SIGNER = mockKeypair('sep10');
export const OPS_MEMBER = account('ops');
export const SHOP_OWNER = account('shop-owner');
export const BOT = account('bot');

export const PERSONA_ADDRESS: Record<Persona, string> = {
  user: USER,
  merchant: MERCHANT_WALLET,
  business: BUSINESS_WALLET,
  fresh: FRESH,
};

/** The mock market runs on testnet's passphrase with Circle's testnet USDC issuer; the market
    contract is a made-up id. */
const PASSPHRASE = PASSPHRASES.testnet;
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const USDC = {
  symbol: 'USDC',
  code: 'USDC',
  issuer: USDC_ISSUER,
  contract: new Asset('USDC', USDC_ISSUER).contractId(PASSPHRASE),
  decimals: 7,
};

export const NETWORK = {
  id: 'testnet',
  name: 'Stellar Testnet',
  networkPassphrase: PASSPHRASE,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
  contract: contract('market'),
  tokens: [USDC],
};
export const NETWORKS = [NETWORK];
export const MARKET_CONTRACT = NETWORK.contract;

const field = (key: string, required = true) => ({ key, required });

export const CURRENCIES = [
  {
    code: 'BOB',
    rails: [
      {
        id: 'bo_bank_transfer',
        fields: [
          field('bank'),
          field('accountType'),
          field('accountNumber'),
          field('documentType'),
          field('documentNumber'),
        ],
      },
    ],
  },
  {
    code: 'PEN',
    rails: [
      {
        id: 'pe_bank_transfer',
        fields: [field('cci'), field('documentType'), field('documentNumber')],
      },
      { id: 'pe_qr', fields: [] },
    ],
  },
  {
    code: 'BRL',
    rails: [
      { id: 'br_pix', fields: [field('keyType'), field('key')] },
      { id: 'br_pix_qr', fields: [] },
    ],
  },
  {
    code: 'ARS',
    rails: [
      {
        id: 'ar_bank_transfer',
        fields: [field('cbu', false), field('alias', false), field('cuit')],
      },
      { id: 'ar_qr', fields: [] },
    ],
  },
  {
    code: 'CLP',
    rails: [
      {
        id: 'cl_bank_transfer',
        fields: [field('bank'), field('accountType'), field('accountNumber'), field('rut')],
      },
    ],
  },
  {
    code: 'COP',
    rails: [
      {
        id: 'co_bank_transfer',
        fields: [
          field('bank'),
          field('accountType'),
          field('accountNumber'),
          field('documentType'),
          field('documentNumber'),
        ],
      },
    ],
  },
  { code: 'MXN', rails: [{ id: 'mx_spei', fields: [field('clabe')] }] },
];

/** Price of 1 USDC in each currency, for the user's purchase (the merchant sells) and sale. */
export const PRICES: Record<string, { buy: number; sell: number }> = {
  BOB: { buy: 12.05, sell: 11.85 },
  ARS: { buy: 1488.5, sell: 1452 },
  BRL: { buy: 5.47, sell: 5.36 },
  MXN: { buy: 18.92, sell: 18.55 },
  COP: { buy: 4135, sell: 4060 },
  PEN: { buy: 3.77, sell: 3.7 },
  CLP: { buy: 951, sell: 932 },
};

/** The rules the mock market runs by (seconds, basis points). */
export const RULES = {
  protocolFeeBps: 30,
  bondBps: 1000,
  buyPaymentSeconds: 1800,
  sellAcceptSeconds: 300,
  sellPaymentSeconds: 1800,
  sellSettleSeconds: 21600,
  qrAcceptSeconds: 120,
  qrPaymentSeconds: 600,
  qrSettleSeconds: 3600,
};

/** `GET /v1/market` as the API answers it (MarketOverviewView). */
export const MARKET = {
  available: true,
  networks: NETWORKS.map((n) => ({
    ...n,
    paused: false,
    protocolFeeBps: RULES.protocolFeeBps,
  })),
  currencies: CURRENCIES.map((c) => ({
    code: c.code,
    decimals: c.code === 'CLP' ? 0 : 2,
    rails: c.rails.map((r) => ({
      id: r.id,
      name: r.id,
      fields: r.fields.map((f) => ({ name: f.key, description: '', required: f.required })),
    })),
  })),
  bondBps: RULES.bondBps,
  maxIntegratorFeeBps: 500,
  windows: {
    buyPaymentWindow: RULES.buyPaymentSeconds,
    sellAcceptWindow: RULES.sellAcceptSeconds,
    sellPaymentWindow: RULES.sellPaymentSeconds,
    sellSettleWindow: RULES.sellSettleSeconds,
  },
  matcher: MATCHER,
  sponsor: { enabled: true },
};

/** The merchants the matcher picks from in mock mode (their public profile only). */
export const MERCHANTS = [
  {
    displayName: 'Norte Cambios',
    completed: 1284,
    completionRate: 0.992,
    medianReleaseSeconds: 140,
    disputesLost: 1,
  },
  {
    displayName: 'Sucre Cambios',
    completed: 312,
    completionRate: 0.981,
    medianReleaseSeconds: 260,
    disputesLost: 0,
  },
];

/** The merchant's own account the user pays into on a purchase, per rail. */
export const MERCHANT_ACCOUNTS: Record<
  string,
  { holderName: string; document: string | null; details: Record<string, string> }
> = {
  bo_bank_transfer: {
    holderName: 'Norte Cambios SRL',
    document: '1020304025',
    details: {
      bank: 'Banco Unión',
      accountType: 'checking',
      accountNumber: '1000023456789',
      documentType: 'NIT',
      documentNumber: '1020304025',
    },
  },
  ar_bank_transfer: {
    holderName: 'Norte Cambios SRL',
    document: '30-71234567-9',
    details: { cbu: '0170099222000001234561', cuit: '30712345679' },
  },
  br_pix: {
    holderName: 'Norte Câmbio Ltda',
    document: null,
    details: { keyType: 'email', key: 'pix@nortecambios.example' },
  },
  mx_spei: {
    holderName: 'Cambios del Norte SA',
    document: null,
    details: { clabe: '002010077777777771' },
  },
  co_bank_transfer: {
    holderName: 'Cambios Norte SAS',
    document: null,
    details: {
      bank: 'Bancolombia',
      accountType: 'savings',
      accountNumber: '12345678901',
      documentType: 'NIT',
      documentNumber: '9001234567',
    },
  },
  pe_bank_transfer: {
    holderName: 'Cambios Norte SAC',
    document: null,
    details: { cci: '00219300123456789012', documentType: 'RUC', documentNumber: '20100070970' },
  },
  cl_bank_transfer: {
    holderName: 'Cambios Norte SpA',
    document: null,
    details: {
      bank: 'Banco Estado',
      accountType: 'checking',
      accountNumber: '12345678',
      rut: '76.123.456-0',
    },
  },
};

export const ORGS = [
  {
    id: 'org_nortecambios',
    name: 'Norte Cambios',
    role: 'owner',
    createdAt: '2026-09-02T13:00:00.000Z',
  },
  {
    id: 'org_tiendamamore',
    name: 'Tienda Mamoré',
    role: 'admin',
    createdAt: '2026-10-11T15:30:00.000Z',
  },
];

/** The handles that already exist in mock mode. */
export const HANDLES: Record<string, string> = {
  lucia: FRIEND,
  nortecambios: MERCHANT_WALLET,
  tiendamamore: BUSINESS_WALLET,
};
/** Words nobody can claim as a handle. */
export const RESERVED_HANDLES = ['admin', 'support', 'soporte', 'midpoint', 'app', 'root'];
