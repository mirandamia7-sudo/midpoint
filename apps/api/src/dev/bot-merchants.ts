import { Keypair, Operation, type rpc } from '@stellar/stellar-sdk';
import { rpcFor, submitOps } from '@/chain/market-deploy';
import { DevApi, organizationWithKey, registerAccount, signIn } from '@/dev/dev-api';
import { devDollar, walletBalances, type DevDollar } from '@/dev/dev-dollars';
import {
  authoriseMatcher,
  depositSpareLumens,
  describeSync,
  ensureDollarLiquidity,
  syncMerchantMarket,
  type MerchantMethod,
  type MerchantOffer,
  type MerchantSession,
} from '@/dev/merchant-sync';
import {
  APPROX_USD,
  APPROX_XLM_USD,
  LUMEN_SYMBOL,
  offerPrice,
  type PriceCurrency,
  type PriceFeed,
} from '@/dev/price-feed';
import {
  fund,
  refuseMainnet,
  type DevAccounts,
  type DevChain,
  type DevMarket,
  type DevNetwork,
} from '@/dev/stellar-dev';
import { P2P_CURRENCIES } from '@/p2p/domain/constants';

/**
 * The dev stack's three automated test merchants (testnet and local only), on
 * top of the seeded one: each its own account (friendbot-funded), organization,
 * `pk_test_` key, payment methods (Bolivia first) and offers, with liquidity
 * in the market for both tokens it trades (the network's dollar: Circle's
 * USDC on testnet, bought with test lumens on the DEX, or TUSD on the local
 * network; and XLM) and the matcher authorised. A bot per merchant (the SDK's
 * simulated merchant) then plays its side of every order through the public
 * API, and the stack reprices its offers from live references.
 *
 * Set-up goes THROUGH THE API like the seed, and in steps that are saved as
 * they finish (`save`), so a restart resumes where the last run stopped and an
 * existing merchant is reused, never created again. Every start also syncs a
 * ready merchant (`@/dev/merchant-sync`): payment methods and offers it lacks
 * are added, offers in a token it no longer trades are deactivated, and its
 * dollar liquidity is topped up to its target. These are test keys, printed
 * on purpose and never used on mainnet.
 */

/** A bot's key in the saved state. Kept when a display name changes ('pampa' is Illimani Pagos), so
    a running market keeps its funded merchants. */
export type BotMerchantSlug = 'andes' | 'pampa' | 'rio';

/** The QR rails a bot pays shop QRs on: Peru's (Yape, Plin, banks), PIX and Argentina's. */
export type BotQrRail = 'ar_qr' | 'br_pix_qr' | 'pe_qr';

/** A rail account the merchant collects on (local money in) and pays from. */
export type BotPaymentMethod = MerchantMethod;

export interface BotMerchantProfile {
  slug: BotMerchantSlug;
  displayName: string;
  /** Its spread around the reference, basis points each way. */
  spreadBps: number;
  /** One bank-transfer (or PIX, SPEI) account per currency it trades, Bolivia first. */
  methods: readonly BotPaymentMethod[];
  /** QR rails it pays shop QRs on (it buys tokens there). */
  qrRails: readonly BotQrRail[];
}

/** The three merchants, each with its own spread so the matcher has real choices. */
export const BOT_MERCHANTS: readonly BotMerchantProfile[] = [
  {
    slug: 'andes',
    displayName: 'Andes Cambio',
    spreadBps: 60,
    methods: [
      {
        currency: 'BOB',
        rail: 'bo_bank_transfer',
        holderName: 'Andes Cambio SRL',
        details: {
          bank: 'Banco Unión',
          accountType: 'savings',
          accountNumber: '1000012345678',
          documentType: 'NIT',
          documentNumber: '1023456789',
        },
      },
      {
        currency: 'ARS',
        rail: 'ar_bank_transfer',
        holderName: 'Andes Cambio SRL',
        details: { alias: 'andes.cambio', cuit: '30712345671' },
      },
      {
        currency: 'CLP',
        rail: 'cl_bank_transfer',
        holderName: 'Andes Cambio SpA',
        details: {
          bank: 'Banco de Chile',
          accountType: 'checking',
          accountNumber: '0012345678',
          rut: '76123456-0',
        },
      },
      {
        currency: 'PEN',
        rail: 'pe_bank_transfer',
        holderName: 'Andes Cambio SAC',
        details: {
          cci: '00219300123456789012',
          documentType: 'RUC',
          documentNumber: '20601234567',
        },
      },
      {
        currency: 'COP',
        rail: 'co_bank_transfer',
        holderName: 'Andes Cambio SAS',
        details: {
          bank: 'Bancolombia',
          accountType: 'savings',
          accountNumber: '24512345678',
          documentType: 'NIT',
          documentNumber: '901234567',
        },
      },
    ],
    qrRails: ['ar_qr', 'pe_qr'],
  },
  {
    slug: 'pampa',
    displayName: 'Illimani Pagos',
    spreadBps: 90,
    methods: [
      {
        currency: 'BOB',
        rail: 'bo_bank_transfer',
        holderName: 'Illimani Pagos SRL',
        details: {
          bank: 'Banco Mercantil Santa Cruz',
          accountType: 'checking',
          accountNumber: '4010123456',
          documentType: 'NIT',
          documentNumber: '387654021',
        },
      },
      {
        currency: 'ARS',
        rail: 'ar_bank_transfer',
        holderName: 'Illimani Pagos SA',
        details: { cbu: '0170099222000012345670', cuit: '30712345698' },
      },
      {
        currency: 'BRL',
        rail: 'br_pix',
        holderName: 'Illimani Pagos LTDA',
        details: { keyType: 'email', key: 'pix@illimanipagos.example' },
      },
      {
        currency: 'MXN',
        rail: 'mx_spei',
        holderName: 'Illimani Pagos SA de CV',
        details: { clabe: '002180012345678906' },
      },
      {
        currency: 'CLP',
        rail: 'cl_bank_transfer',
        holderName: 'Illimani Pagos SpA',
        details: {
          bank: 'Banco Santander',
          accountType: 'vista',
          accountNumber: '7654321098',
          rut: '77654321-7',
        },
      },
    ],
    qrRails: ['ar_qr', 'br_pix_qr', 'pe_qr'],
  },
  {
    slug: 'rio',
    displayName: 'Río Express',
    spreadBps: 120,
    methods: [
      {
        currency: 'BOB',
        rail: 'bo_bank_transfer',
        holderName: 'Río Express SRL',
        details: {
          bank: 'Banco BISA',
          accountType: 'savings',
          accountNumber: '0012345017',
          documentType: 'NIT',
          documentNumber: '1028765432',
        },
      },
      {
        currency: 'ARS',
        rail: 'ar_bank_transfer',
        holderName: 'Río Express SRL',
        details: { alias: 'rio.express', cuit: '30700000016' },
      },
      {
        currency: 'BRL',
        rail: 'br_pix',
        holderName: 'Rio Express LTDA',
        details: { keyType: 'evp', key: '5f0c8a3e-2b1d-4c6e-9a7f-1e2d3c4b5a69' },
      },
      {
        currency: 'MXN',
        rail: 'mx_spei',
        holderName: 'Río Express SA de CV',
        details: { clabe: '014180012345678910' },
      },
      {
        currency: 'COP',
        rail: 'co_bank_transfer',
        holderName: 'Río Express SAS',
        details: {
          bank: 'Davivienda',
          accountType: 'checking',
          accountNumber: '00987654321',
          documentType: 'NIT',
          documentNumber: '900765432',
        },
      },
      {
        currency: 'PEN',
        rail: 'pe_bank_transfer',
        holderName: 'Río Express SAC',
        details: {
          cci: '00311000987654321098',
          documentType: 'RUC',
          documentNumber: '20509876543',
        },
      },
    ],
    qrRails: ['br_pix_qr', 'pe_qr'],
  },
];

/** The seeded merchant's spread: the widest, so the automated merchants usually win. */
export const SEEDED_MERCHANT_SPREAD_BPS = 150;

/** What the dev stack keeps of a bot merchant in `.dev-stack/` (test keys). */
export interface BotMerchant {
  slug: BotMerchantSlug;
  displayName: string;
  spreadBps: number;
  publicKey: string;
  /** A TEST key (testnet or local only). */
  secret: string;
  network: DevNetwork;
  /** The market it was set up on: another market starts it over. */
  market: string;
  /**
   * Funded and trusting the network's dollar (`usdc`: Circle's USDC, bought on
   * the DEX; otherwise TUSD, minted).
   */
  chain?: { usdc: boolean };
  /** Its organization, API key and merchant account. */
  api?: { organizationId: string; apiKey: string; accountId?: string };
  /** Active offers after the last sync (its payment methods are in place). */
  offers?: number;
  /** Its free balance in the market after the last sync, base units by token symbol. */
  liquidity?: Record<string, string>;
  /** The matcher is authorised on its balance. */
  matcher?: boolean;
}

/** Whether a merchant finished its set-up (its bot can run). */
export function botMerchantReady(m: BotMerchant): boolean {
  return Boolean(m.chain && m.api?.accountId && m.offers && m.liquidity && m.matcher);
}

/** Units of one token (7 decimals). */
const U = 10_000_000n;
/** Lumens each merchant keeps in its wallet (reserves, and a margin); the rest is liquidity. */
export const LUMENS_KEPT = 1_500n * U;
/** Extra friendbot accounts merged into each new merchant, for more lumens (failures are fine). */
const LUMEN_TOP_UPS = 1;
/**
 * Each bot merchant's dollar liquidity in the market: 5 000 USDC bought on
 * the testnet DEX, or 200 000 TUSD minted on the local network.
 */
export function botDollarTarget(dollar: Pick<DevDollar, 'source'>): bigint {
  return dollar.source === 'dex' ? 5_000n * U : 200_000n * U;
}
/** The largest order the matcher may open on a merchant, base units of any token. */
export const MATCHER_MAX_PER_ORDER = 5_000n * U;
/** An offer's price lifetime: the stack's price loop renews it every minute. */
const PRICE_TTL_SECONDS = 900;
/** Offer bounds, US dollars of local money, per token. */
const OFFER_MIN_USD = 1;
export const OFFER_MAX_USD: Readonly<Record<string, number>> = {
  USDC: 2_000,
  TUSD: 2_000,
  XLM: 300,
};

/** The QR rails' currencies. */
const QR_CURRENCY: Record<BotQrRail, PriceCurrency> = {
  ar_qr: 'ARS',
  br_pix_qr: 'BRL',
  pe_qr: 'PEN',
};

export type BotOffer = MerchantOffer;

/**
 * Every offer a merchant publishes, priced from `reference` with its spread:
 * for each token and each currency it holds an account in, it sells tokens
 * (people buy) and buys them (people sell) by bank transfer; on each QR rail
 * it buys tokens (it pays the shop's QR). Bounds are about 1 US dollar to the
 * token's maximum, in local money. Pure.
 */
export function botOffers(
  profile: BotMerchantProfile,
  tokens: readonly string[],
  reference: (symbol: string, currency: string) => number | null,
): BotOffer[] {
  const offers: BotOffer[] = [];
  const priced = (symbol: string, currency: PriceCurrency) =>
    reference(symbol, currency) ??
    (symbol === LUMEN_SYMBOL ? APPROX_XLM_USD : 1) * APPROX_USD[currency];
  const usd = (currency: PriceCurrency) => reference('USDC', currency) ?? APPROX_USD[currency];
  const bounds = (symbol: string, currency: PriceCurrency) => {
    const rate = usd(currency);
    const decimals = P2P_CURRENCIES[currency].decimals;
    const step = 10 ** decimals;
    const min = Math.ceil(OFFER_MIN_USD * rate * step) / step;
    const max = Math.floor((OFFER_MAX_USD[symbol] ?? 100) * rate * step) / step;
    return { minFiat: min.toFixed(decimals), maxFiat: max.toFixed(decimals) };
  };
  for (const token of tokens) {
    const add = (side: BotOffer['side'], currency: PriceCurrency, rail: string) =>
      offers.push({
        side,
        token,
        currency,
        rails: [rail],
        price: offerPrice(priced(token, currency), side, profile.spreadBps),
        priceTtlSeconds: PRICE_TTL_SECONDS,
        ...bounds(token, currency),
      });
    for (const method of profile.methods) {
      add('SELL_TOKEN', method.currency, method.rail);
      add('BUY_TOKEN', method.currency, method.rail);
    }
    for (const rail of profile.qrRails) add('BUY_TOKEN', QR_CURRENCY[rail], rail);
  }
  return offers;
}

/** The tokens a dev merchant trades: the network's dollar, then XLM. */
export function devMerchantTokens(dollar: Pick<DevDollar, 'symbol'>): string[] {
  return [dollar.symbol, LUMEN_SYMBOL];
}

// --- chain steps -------------------------------------------------------------------

/** Merges fresh friendbot accounts into `to` for more test lumens; a failure only logs. */
async function topUpLumens(
  server: rpc.Server,
  chain: DevChain,
  to: string,
  times: number,
  log: (m: string) => void,
): Promise<void> {
  for (let i = 0; i < times; i++) {
    const extra = Keypair.random();
    try {
      await fund(chain.friendbotUrl, extra.publicKey());
      await submitOps(server, chain.passphrase, extra, [
        Operation.accountMerge({ destination: to }),
      ]);
    } catch (err) {
      log(`lumen top-up skipped: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
  }
}

// --- the set-up ---------------------------------------------------------------------

export interface BotMerchantsInput {
  apiUrl: string;
  webOrigin: string;
  chain: DevChain;
  market: DevMarket;
  accounts: DevAccounts;
  feed: Pick<PriceFeed, 'reference'>;
  /** What `.dev-stack/` kept from earlier runs, or null. */
  previous: BotMerchant[] | null;
  /** The database was reset: organizations, keys and offers are set up again (chain state stays). */
  freshDatabase: boolean;
  /** Persists the merchants (called after every finished step; keys first). */
  save: (merchants: BotMerchant[]) => void;
  log?: (message: string) => void;
}

/**
 * Creates the bot merchants a run lacks, finishes any set-up an earlier run
 * left halfway and syncs the ready ones, saving after every step. A merchant
 * whose set-up fails is logged and left for the next run; the others go on.
 */
export async function setUpBotMerchants(input: BotMerchantsInput): Promise<BotMerchant[]> {
  const log = input.log ?? (() => undefined);
  refuseMainnet(input.chain.network);
  const merchants: BotMerchant[] = BOT_MERCHANTS.map((profile) => {
    const old = input.previous?.find(
      (m) =>
        m.slug === profile.slug &&
        m.market === input.market.contract &&
        m.network === input.chain.network,
    );
    if (old) {
      const kept = input.freshDatabase ? { ...old, api: undefined, offers: undefined } : old;
      return { ...kept, displayName: profile.displayName, spreadBps: profile.spreadBps };
    }
    const key = Keypair.random();
    return {
      slug: profile.slug,
      displayName: profile.displayName,
      spreadBps: profile.spreadBps,
      publicKey: key.publicKey(),
      secret: key.secret(),
      network: input.chain.network,
      market: input.market.contract,
    };
  });
  // The keys before anything else: they are about to hold testnet funds.
  input.save(merchants);
  for (const [i, merchant] of merchants.entries()) {
    const say = (m: string) => log(`${merchant.displayName}: ${m}`);
    try {
      await setUpOne(input, BOT_MERCHANTS[i], merchant, () => input.save(merchants), say);
    } catch (err) {
      say(`set-up stopped (the next run resumes it): ${err instanceof Error ? err.message : err}`);
    }
  }
  return merchants;
}

async function setUpOne(
  input: BotMerchantsInput,
  profile: BotMerchantProfile,
  m: BotMerchant,
  save: () => void,
  log: (message: string) => void,
): Promise<void> {
  const { chain, market, accounts } = input;
  const server = await rpcFor(chain.rpcUrl, chain.passphrase);
  const key = Keypair.fromSecret(m.secret);
  const dollar = devDollar(chain, market);

  if (!m.chain) {
    await fund(chain.friendbotUrl, m.publicKey);
    await topUpLumens(server, chain, m.publicKey, LUMEN_TOP_UPS, log);
    if ((await walletBalances(server, m.publicKey, dollar.asset)).asset === null) {
      await submitOps(server, chain.passphrase, key, [
        Operation.changeTrust({ asset: dollar.asset }),
      ]);
    }
    m.chain = { usdc: dollar.symbol === 'USDC' };
    save();
    log(`funded, trusting ${dollar.symbol}`);
  }

  const api = new DevApi(input.apiUrl, input.webOrigin);
  if (!m.api) {
    const session = await signIn(api, key);
    m.api = await organizationWithKey(api, session, m.displayName);
    save();
  }
  if (!m.api.accountId) {
    m.api.accountId = (await registerAccount(api, m.api.apiKey, key, m.displayName)).id;
    save();
  }
  const s: MerchantSession = {
    api,
    apiKey: m.api.apiKey,
    accountId: m.api.accountId,
    key,
    chain,
    market,
    server,
  };

  // Payment methods and offers: what it lacks is published, offers in a token it no
  // longer trades are deactivated (a stack set up while testnet listed TUSD catches up).
  const tokens = devMerchantTokens(dollar);
  const synced = await syncMerchantMarket(
    s,
    profile.methods,
    botOffers(profile, tokens, (symbol, currency) => input.feed.reference(symbol, currency)),
    tokens,
  );
  m.offers = synced.activeOffers;
  save();
  const changed = describeSync(synced);
  if (changed) log(changed);

  // Liquidity: the dollar topped up to its target, the spare lumens deposited.
  const dollars = await ensureDollarLiquidity(s, {
    dollar,
    accounts,
    target: botDollarTarget(dollar),
    log,
  });
  const lumens = await depositSpareLumens(s, LUMENS_KEPT, log);
  m.liquidity = { [dollar.symbol]: dollars.toString(), [LUMEN_SYMBOL]: lumens.toString() };
  save();

  if (!m.matcher) {
    await authoriseMatcher(s, accounts.matcher.publicKey, MATCHER_MAX_PER_ORDER);
    m.matcher = true;
    save();
    log('matcher authorised');
  }
}
