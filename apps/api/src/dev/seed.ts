import type { rpc } from '@stellar/stellar-sdk';
import { rpcFor } from '@/chain/market-deploy';
import { DevApi, organizationWithKey, registerAccount, signAndSubmit, signIn } from '@/dev/dev-api';
import { devDollar, obtainDollars, walletBalances, type DevDollar } from '@/dev/dev-dollars';
import {
  amountText,
  authoriseMatcher,
  depositSpareLumens,
  describeSync,
  ensureDollarLiquidity,
  syncMerchantMarket,
  type MerchantMethod,
  type MerchantOffer,
  type MerchantSession,
} from '@/dev/merchant-sync';
import { APPROX_XLM_USD, LUMEN_SYMBOL } from '@/dev/price-feed';
import { keypair, type DevAccounts, type DevChain, type DevMarket } from '@/dev/stellar-dev';
import { P2P_CURRENCIES } from '@/p2p/domain/constants';

/**
 * Seeds a dev market THROUGH THE API, the way a real merchant, business and
 * person would set themselves up: SEP-10 sign-in, an organization each, a
 * test API key, accounts registered with SEP-10 proofs, payment methods
 * (Bolivia first), offers in the network's dollar and XLM (QR payments
 * included), liquidity deposited and the matcher authorised with transactions
 * the API built, the dev keys signed and the API submitted (sponsored), a
 * charge in bolivianos, and the user's account activated by the sponsor and
 * given dollars. The dollar is Circle's USDC on testnet (bought with test
 * lumens on the DEX) and the stack's TUSD on the local network (minted).
 *
 * {@link syncDevSeed} brings a stack seeded earlier up to date on a restart,
 * idempotently: what the merchant lacks, the user's dollars, the charge's token.
 */

export interface SeedResult {
  merchant: { organizationId: string; apiKey: string; accountId: string; address: string };
  business: { organizationId: string; apiKey: string; accountId: string; address: string };
  user: { address: string };
  charge: { id: string; url: string };
}

/** Units of one token (7 decimals). */
const U = 10_000_000n;

/** The seeded merchant's display name (a manual merchant: `npm run dev:simulate` plays it). */
export const SEEDED_MERCHANT_NAME = 'Oriente Cambio';

/** The seeded merchant's payment methods, Bolivia first. */
export const SEEDED_MERCHANT_METHODS: readonly MerchantMethod[] = [
  {
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    holderName: 'Oriente Cambio SRL',
    details: {
      bank: 'Banco Nacional de Bolivia',
      accountType: 'checking',
      accountNumber: '3000123456',
      documentType: 'NIT',
      documentNumber: '1020304025',
    },
    label: 'Main BOB account',
  },
  {
    currency: 'ARS',
    rail: 'ar_bank_transfer',
    holderName: 'Oriente Cambio SRL',
    details: { cbu: '2850590940090418135201', cuit: '20123456786' },
    label: 'Main ARS account',
  },
  {
    currency: 'BRL',
    rail: 'br_pix',
    holderName: 'Oriente Cambio LTDA',
    details: { keyType: 'email', key: 'pix@orientecambio.example' },
    label: 'PIX',
  },
];

type SeededOffer = Omit<MerchantOffer, 'token' | 'priceTtlSeconds'>;

/** Its offers per dollar, at fixed test prices (the dev stack's price loop reprices them). */
const SEEDED_DOLLAR_OFFERS: readonly SeededOffer[] = [
  {
    side: 'SELL_TOKEN',
    currency: 'BOB',
    rails: ['bo_bank_transfer'],
    price: '12.1',
    minFiat: '10',
    maxFiat: '20000',
  },
  {
    side: 'BUY_TOKEN',
    currency: 'BOB',
    rails: ['bo_bank_transfer'],
    price: '11.7',
    minFiat: '10',
    maxFiat: '20000',
  },
  {
    side: 'SELL_TOKEN',
    currency: 'ARS',
    rails: ['ar_bank_transfer'],
    price: '1250',
    minFiat: '1000',
    maxFiat: '2000000',
  },
  {
    side: 'BUY_TOKEN',
    currency: 'ARS',
    rails: ['ar_bank_transfer'],
    price: '1180',
    minFiat: '1000',
    maxFiat: '2000000',
  },
  {
    side: 'BUY_TOKEN',
    currency: 'ARS',
    rails: ['ar_qr'],
    price: '1190',
    minFiat: '100',
    maxFiat: '500000',
  },
  {
    side: 'SELL_TOKEN',
    currency: 'BRL',
    rails: ['br_pix'],
    price: '5.6',
    minFiat: '10',
    maxFiat: '10000',
  },
  {
    side: 'BUY_TOKEN',
    currency: 'BRL',
    rails: ['br_pix'],
    price: '5.3',
    minFiat: '10',
    maxFiat: '10000',
  },
  {
    side: 'BUY_TOKEN',
    currency: 'BRL',
    rails: ['br_pix_qr'],
    price: '5.35',
    minFiat: '1',
    maxFiat: '5000',
  },
];

/** A seeded price lifetime: a day (the dev stack's price loop renews it every minute). */
const SEEDED_PRICE_TTL_SECONDS = 24 * 60 * 60;

/**
 * The seeded merchant's offers in `tokens`: the dollar ones at their fixed
 * prices; XLM at those prices times a rough lumen price, up to a fifth of the
 * dollar maximum. Pure.
 */
export function seededOffers(tokens: readonly string[]): MerchantOffer[] {
  return tokens.flatMap((token) =>
    SEEDED_DOLLAR_OFFERS.map((o): MerchantOffer => {
      if (token !== LUMEN_SYMBOL) return { ...o, token, priceTtlSeconds: SEEDED_PRICE_TTL_SECONDS };
      const decimals = P2P_CURRENCIES[o.currency].decimals;
      const price = (Number(o.price) * APPROX_XLM_USD).toFixed(6).replace(/\.?0+$/, '');
      const max = Math.floor((Number(o.maxFiat) / 5) * 10 ** decimals) / 10 ** decimals;
      return {
        ...o,
        token,
        price,
        maxFiat: max.toFixed(decimals),
        priceTtlSeconds: SEEDED_PRICE_TTL_SECONDS,
      };
    }),
  );
}

/** The seeded merchant's dollar liquidity: 5 000 USDC (testnet), or 100 000 TUSD (local). */
export function seededDollarTarget(dollar: Pick<DevDollar, 'source'>): bigint {
  return dollar.source === 'dex' ? 5_000n * U : 100_000n * U;
}

/** The dev user's dollars: 1 000 USDC (testnet, bought), or 5 000 TUSD (local, minted). */
export function userDollarTarget(dollar: Pick<DevDollar, 'source'>): bigint {
  return dollar.source === 'dex' ? 1_000n * U : 5_000n * U;
}

/** Lumens the seeded merchant keeps in its wallet; the rest is liquidity. */
const SEEDED_LUMENS_KEPT = 1_500n * U;
/** The largest order the matcher may open on the seeded merchant, base units of any token. */
const SEEDED_MATCHER_MAX_PER_ORDER = 5_000n * U;

interface SeedContext {
  api: DevApi;
  chain: DevChain;
  market: DevMarket;
  accounts: DevAccounts;
  server: rpc.Server;
  dollar: DevDollar;
  log: (m: string) => void;
}

/** Syncs the seeded merchant: methods, offers (a token it no longer trades deactivated), liquidity. */
async function syncSeededMerchant(
  ctx: SeedContext,
  merchant: { apiKey: string; accountId: string },
): Promise<MerchantSession> {
  const s: MerchantSession = {
    api: ctx.api,
    apiKey: merchant.apiKey,
    accountId: merchant.accountId,
    key: keypair(ctx.accounts.merchant),
    chain: ctx.chain,
    market: ctx.market,
    server: ctx.server,
  };
  const say = (m: string) => ctx.log(`${SEEDED_MERCHANT_NAME}: ${m}`);
  const tokens = [ctx.dollar.symbol, LUMEN_SYMBOL];
  const synced = await syncMerchantMarket(s, SEEDED_MERCHANT_METHODS, seededOffers(tokens), tokens);
  const changed = describeSync(synced);
  if (changed) say(changed);
  await ensureDollarLiquidity(s, {
    dollar: ctx.dollar,
    accounts: ctx.accounts,
    target: seededDollarTarget(ctx.dollar),
    log: say,
  });
  await depositSpareLumens(s, SEEDED_LUMENS_KEPT, say);
  return s;
}

/**
 * Activates the dev user for the dollar (the sponsor's transaction, signed by
 * the user) and gives it dollars when it holds less than half its target.
 */
async function ensureUserDollars(ctx: SeedContext): Promise<void> {
  const userKey = keypair(ctx.accounts.user);
  const session = await signIn(ctx.api, userKey);
  const activation = await ctx.api.call<{
    transaction: { xdr: string; network: string } | null;
  }>('POST', '/v1/app/activate', session, {
    network: ctx.chain.network,
    token: ctx.dollar.symbol,
  });
  if (activation.transaction) {
    await signAndSubmit(
      ctx.api,
      session,
      'app',
      activation.transaction,
      userKey,
      ctx.chain.passphrase,
    );
    ctx.log(`user activated by the sponsor for ${ctx.dollar.symbol}`);
  }
  const target = userDollarTarget(ctx.dollar);
  const held = (await walletBalances(ctx.server, userKey.publicKey(), ctx.dollar.asset)).asset;
  if ((held ?? 0n) * 2n >= target) return;
  const got = await obtainDollars({
    server: ctx.server,
    chain: ctx.chain,
    accounts: ctx.accounts,
    dollar: ctx.dollar,
    to: userKey.publicKey(),
    units: target - (held ?? 0n),
    mergeInto: ctx.accounts.sponsor.publicKey,
    log: ctx.log,
  });
  ctx.log(`user given ${amountText(got)} ${ctx.dollar.symbol}`);
}

/** The business's multi-use test charge: 150 bolivianos, paid in the network's dollar. */
async function createCharge(
  ctx: SeedContext,
  business: { apiKey: string; accountId: string },
): Promise<{ id: string; url: string }> {
  const charge = await ctx.api.call<{ id: string; url: string }>(
    'POST',
    '/v1/p2p/charges',
    business.apiKey,
    {
      network: ctx.chain.network,
      token: ctx.dollar.symbol,
      currency: 'BOB',
      fiatAmount: '150',
      recipient: business.accountId,
      payeeName: 'Dev Business',
      description: 'A test charge',
      multiUse: true,
      expiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
    },
  );
  return { id: charge.id, url: charge.url };
}

async function context(input: {
  apiUrl: string;
  webOrigin: string;
  chain: DevChain;
  market: DevMarket;
  accounts: DevAccounts;
  log?: (m: string) => void;
}): Promise<SeedContext> {
  return {
    api: new DevApi(input.apiUrl, input.webOrigin),
    chain: input.chain,
    market: input.market,
    accounts: input.accounts,
    server: await rpcFor(input.chain.rpcUrl, input.chain.passphrase),
    dollar: devDollar(input.chain, input.market),
    log: input.log ?? (() => undefined),
  };
}

export async function seedDevMarket(input: {
  apiUrl: string;
  webOrigin: string;
  chain: DevChain;
  market: DevMarket;
  accounts: DevAccounts;
  log?: (m: string) => void;
}): Promise<SeedResult> {
  const ctx = await context(input);
  const { api, accounts, dollar, log } = ctx;

  // --- the merchant: sells and buys tokens against BOB, ARS and BRL, and pays QRs -----
  const merchantKey = keypair(accounts.merchant);
  const merchantSession = await signIn(api, merchantKey);
  const merchant = await organizationWithKey(api, merchantSession, 'Dev Merchant');
  const merchantAccount = await registerAccount(
    api,
    merchant.apiKey,
    merchantKey,
    SEEDED_MERCHANT_NAME,
  );
  const session = await syncSeededMerchant(ctx, {
    apiKey: merchant.apiKey,
    accountId: merchantAccount.id,
  });
  await authoriseMatcher(session, accounts.matcher.publicKey, SEEDED_MATCHER_MAX_PER_ORDER);
  log(
    `merchant seeded: offers (BOB, ARS, BRL, QR) in ${dollar.symbol} and XLM, liquidity, matcher authorised`,
  );

  // --- the business: integrates buy/sell and collects with charges -----------
  const businessKey = keypair(accounts.business);
  const businessSession = await signIn(api, businessKey);
  const business = await organizationWithKey(api, businessSession, 'Dev Business');
  const businessAccount = await registerAccount(api, business.apiKey, businessKey, 'Dev Business');
  const charge = await createCharge(ctx, {
    apiKey: business.apiKey,
    accountId: businessAccount.id,
  });
  log('business seeded with a charge');

  // --- the user: an account the sponsor creates, then dollars -------------
  await ensureUserDollars(ctx);

  return {
    merchant: { ...merchant, accountId: merchantAccount.id, address: merchantKey.publicKey() },
    business: { ...business, accountId: businessAccount.id, address: businessKey.publicKey() },
    user: { address: keypair(accounts.user).publicKey() },
    charge,
  };
}

/**
 * Brings a stack seeded earlier up to date (a restart, no reset), idempotently:
 * the seeded merchant gets the payment methods and offers it lacks (its offers
 * in a token the market no longer lists deactivated) and its dollar liquidity
 * topped up; the user its dollars; and a charge in a token the market no longer
 * lists is replaced. Answers the seed, with the new charge when it changed.
 */
export async function syncDevSeed(input: {
  apiUrl: string;
  webOrigin: string;
  chain: DevChain;
  market: DevMarket;
  accounts: DevAccounts;
  seed: SeedResult;
  log?: (m: string) => void;
}): Promise<SeedResult> {
  const ctx = await context(input);
  const { seed } = input;
  await syncSeededMerchant(ctx, seed.merchant);
  await ensureUserDollars(ctx);
  const current = await ctx.api.call<{ tokenSymbol: string }>(
    'GET',
    `/v1/p2p/charges/${seed.charge.id}`,
    seed.business.apiKey,
  );
  if (current.tokenSymbol === ctx.dollar.symbol) return seed;
  const charge = await createCharge(ctx, seed.business);
  ctx.log(`the test charge is now in ${ctx.dollar.symbol}: ${charge.url}`);
  return { ...seed, charge };
}

/** Refreshes the dev merchant's active prices (each has a lifetime) after a restart. */
export async function refreshDevPrices(
  apiUrl: string,
  webOrigin: string,
  merchantKey: string,
): Promise<number> {
  const api = new DevApi(apiUrl, webOrigin);
  const offers = await api.all<{ id: string; price: string; active: boolean }>(
    '/v1/p2p/offers',
    merchantKey,
  );
  const active = offers.filter((o) => o.active);
  for (const offer of active) {
    await api.call('PATCH', `/v1/p2p/offers/${offer.id}`, merchantKey, { price: offer.price });
  }
  return active.length;
}
