/**
 * `npm run hosted -- <step> --origin https://…`: a temporary hosted test market
 * (deploy/railway/README.md), apart from the local stack: its own testnet keys,
 * market, merchants and database, so `npm run dev:stack` keeps working beside
 * it. Run from this machine; the state is in .dev-stack/hosted/ (gitignored:
 * TEST keys, testnet only).
 *
 *   init   The accounts and the market on testnet (first run; reused after),
 *          then the API's environment in .dev-stack/hosted/api.env
 *          (`hostedApiEnv`; DATABASE_URL is the platform's Postgres).
 *   seed   Through the hosted API, which must be up: the seeded merchant, the
 *          business and the three automated merchants (a first run takes
 *          minutes on testnet; a rerun resumes), then the merchants service's
 *          environment in .dev-stack/hosted/merchants.env.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BotMerchant, DevAccounts, DevChain, DevMarket, SeedResult } from '@midpoint/api/dev';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, '.dev-stack', 'hosted');
const STATE_FILE = join(DIR, 'state.json');
const MERCHANTS_FILE = join(DIR, 'merchants.json');
/** The API's port on the platform's private network (the web's proxy points at it). */
const API_PORT = 4000;
/** The platform's reference to its Postgres service's URL (Railway resolves it). */
const DATABASE_URL = '${{Postgres.DATABASE_URL}}';

interface HostedState {
  origin: string;
  chain: DevChain;
  accounts: DevAccounts;
  market: DevMarket;
  dataEncryptionKey: string;
  seed?: SeedResult;
}

/** One automated merchant for the merchants service (scripts/hosted-merchants.ts). */
interface HostedMerchant {
  name: string;
  apiKey: string;
  secret: string;
  spreadBps: number;
}

const log = (m: string) => console.log(`[hosted] ${m}`);

function option(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function readState(): HostedState | null {
  return existsSync(STATE_FILE)
    ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as HostedState)
    : null;
}

function saveState(state: HostedState): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

function writeEnv(file: string, env: Record<string, string>): void {
  writeFileSync(
    join(DIR, file),
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  log(`wrote .dev-stack/hosted/${file} (${Object.keys(env).length} variables; test keys)`);
}

async function init(dev: typeof import('@midpoint/api/dev'), origin: string): Promise<void> {
  let state = readState();
  if (state) {
    const server = await dev.rpcFor(state.chain.rpcUrl, state.chain.passphrase);
    const gone = await server.getContractInstance(state.market.contract).then(
      () => false,
      () => true,
    );
    if (gone) {
      throw new Error(
        `the hosted market ${state.market.contract} is gone from testnet (reset or archived): ` +
          'move .dev-stack/hosted aside and run init again (and give the API a fresh database)',
      );
    }
    log(`reusing the market ${state.market.contract}`);
  } else {
    const chain = dev.devChain('testnet');
    const accounts = dev.newDevAccounts();
    log('deploying a market of its own on testnet (friendbot funds its accounts; a few minutes)');
    const market = await dev.setUpDevMarket(chain, accounts, { log });
    state = { origin, chain, accounts, market, dataEncryptionKey: randomBytes(32).toString('hex') };
    saveState(state);
    log(`market ${market.contract}`);
  }
  if (await dev.allowNativeToken(state.chain, state.accounts.owner, state.market.contract)) {
    log('the market now allows the native lumen (XLM)');
  }
  state.origin = origin;
  saveState(state);
  writeEnv(
    'api.env',
    dev.hostedApiEnv({
      origin,
      port: API_PORT,
      databaseUrl: DATABASE_URL,
      chain: state.chain,
      market: state.market,
      accounts: state.accounts,
      dataEncryptionKey: state.dataEncryptionKey,
    }),
  );
}

async function seed(dev: typeof import('@midpoint/api/dev')): Promise<void> {
  const state = readState();
  if (!state)
    throw new Error('no hosted market yet: run `npm run hosted -- init --origin …` first');
  const { origin, chain, market, accounts } = state;
  const at = { apiUrl: origin, webOrigin: origin, chain, market, accounts, log };
  const fresh = !state.seed;
  log(fresh ? 'seeding through the hosted API (a few minutes on testnet)' : 'syncing the seed');
  state.seed = state.seed
    ? await dev.syncDevSeed({ ...at, seed: state.seed })
    : await dev.seedDevMarket(at);
  saveState(state);

  const feed = new dev.PriceFeed({ log });
  await feed.refresh();
  const previous = existsSync(MERCHANTS_FILE)
    ? (JSON.parse(readFileSync(MERCHANTS_FILE, 'utf8')) as BotMerchant[])
    : null;
  const merchants = await dev.setUpBotMerchants({
    ...at,
    feed,
    previous,
    freshDatabase: fresh,
    save: (list) => writeFileSync(MERCHANTS_FILE, JSON.stringify(list, null, 2), { mode: 0o600 }),
  });
  const ready = merchants.filter(dev.botMerchantReady);
  if (ready.length < merchants.length) {
    log(`${merchants.length - ready.length} merchant(s) not set up yet: run seed again to resume`);
  }
  // The seeded merchant gets a bot too: hosted, nobody plays it by hand.
  const list: HostedMerchant[] = [
    {
      name: dev.SEEDED_MERCHANT_NAME,
      apiKey: state.seed.merchant.apiKey,
      secret: accounts.merchant.secret,
      spreadBps: dev.SEEDED_MERCHANT_SPREAD_BPS,
    },
    ...ready.map((m) => ({
      name: m.displayName,
      apiKey: m.api?.apiKey ?? '',
      secret: m.secret,
      spreadBps: m.spreadBps,
    })),
  ];
  writeEnv('merchants.env', {
    ROLE: 'merchants',
    WEB_ORIGIN: origin,
    MARKET_CONTRACT: `testnet=${market.contract}`,
    HOSTED_MERCHANTS: JSON.stringify(list),
  });
}

async function main(): Promise<void> {
  const step = process.argv[2];
  if (step !== 'init' && step !== 'seed') {
    throw new Error('usage: npm run hosted -- init --origin https://… | seed');
  }
  const dev = await import('@midpoint/api/dev');
  mkdirSync(DIR, { recursive: true });
  if (step === 'init') {
    const raw = option('--origin');
    if (!raw) throw new Error('init needs --origin https://… (the web service public domain)');
    await init(dev, new URL(raw).origin);
  } else {
    await seed(dev);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
