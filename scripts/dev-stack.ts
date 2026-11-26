/**
 * `npm run dev:stack`: a whole local market with one command.
 *
 *   1. Postgres: docker compose when the Docker daemon answers, else an
 *      embedded Postgres from npm (never starts Docker itself).
 *   2. Stellar: the local quickstart network (`stellar container start
 *      local`) when a Docker daemon answers, else testnet with friendbot.
 *   3. Dev accounts (owner, arbiter, treasury, matcher, sponsor, SEP-10 signer,
 *      merchant, business, user, TUSD issuer) and the market deployed (first
 *      run, --reset, or when the network lost it).
 *   4. The API (matcher, indexer, expiry, submission and webhook jobs on),
 *      seeded through its own routes: a merchant with liquidity, offers (QR
 *      payments included) and payment methods (Bolivia first), a business with
 *      a test API key and a charge in bolivianos, and the user's account
 *      activated by the sponsor. On testnet the market lists Circle's USDC
 *      (bought with test lumens on the DEX) and the native lumen (XLM); the
 *      local network, which has no Circle, lists the dev dollar TUSD (minted)
 *      and XLM. A restart syncs an existing seed (what it lacks is added,
 *      offers in a token no longer listed are deactivated).
 *   5. The web app, when apps/web has a `dev` script.
 *   6. Three automated test merchants (Andes Cambio, Illimani Pagos, Río
 *      Express), set up through the API on the first run and reused after,
 *      each run by a simulated-merchant bot (the SDK's) that accepts, marks
 *      paid and releases its orders a few seconds later; and live prices:
 *      every minute the four merchants' offers are repriced from mainnet
 *      references (CriptoYa, an FX fallback, and the XLM/USDC book on the
 *      public Horizon), each merchant with its own spread.
 *
 * State persists in .dev-stack/ (a restart resumes); `--reset` starts over.
 * Stop with Ctrl+C, or from another terminal with `npm run dev:stack -- --stop`.
 * Only the processes started here are stopped, each by its own PID.
 *
 * Flags: --reset, --stop, --no-web, --no-build, --testnet (skip the local
 * network even when Docker answers), --api-port N, --web-port N, --pg-port N
 * (also DEV_STACK_API_PORT, DEV_STACK_WEB_PORT, DEV_STACK_PG_PORT). Defaults:
 * API 4100, web 3100, Postgres 54339.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BotMerchant, DevAccounts, DevChain, DevMarket, SeedResult } from '@midpoint/api/dev';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = join(ROOT, '.dev-stack');
const STOP_FILE = join(STATE_DIR, 'stop');
const STACK_FILE = join(STATE_DIR, 'stack.json');
/** The automated test merchants' keys and set-up progress (test keys). */
const MERCHANTS_FILE = join(STATE_DIR, 'merchants.json');
/** How often the merchants' offers are repriced from the live references. */
const PRICE_EVERY_MS = 60_000;
/** The SDK's simulated merchant: one process per automated test merchant. */
const BOT_ENTRY = join(ROOT, 'packages', 'sdk', 'dist', 'bot', 'simulated-merchant.js');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));

function portOption(flag: string, env: string, fallback: number): number {
  const i = args.indexOf(flag);
  const raw = (i >= 0 ? args[i + 1] : undefined) ?? process.env[env];
  const port = raw ? Number(raw) : fallback;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`${flag} must be a port`);
  return port;
}

const API_PORT = portOption('--api-port', 'DEV_STACK_API_PORT', 4100);
const WEB_PORT = portOption('--web-port', 'DEV_STACK_WEB_PORT', 3100);
const PG_PORT = portOption('--pg-port', 'DEV_STACK_PG_PORT', 54339);
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;

interface StackState {
  chain: DevChain;
  accounts: DevAccounts;
  market: DevMarket;
  dataEncryptionKey: string;
  seed: SeedResult;
}

function log(message: string): void {
  console.log(`[dev-stack] ${message}`);
}

function run(command: string, cmdArgs: string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(command, cmdArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
  if (result.status !== 0) throw new Error(`${command} ${cmdArgs.join(' ')} failed`);
}

async function portFree(port: number): Promise<boolean> {
  const { createServer } = await import('node:net');
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function waitFor(url: string, seconds: number): Promise<void> {
  for (let i = 0; i < seconds * 4; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not answer in ${seconds}s`);
}

/** Pipes a child's output to the console with a prefix and to a log file. */
function pipeOutput(child: ChildProcess, name: string): void {
  const file = createWriteStream(join(STATE_DIR, `${name}.log`), { flags: 'a' });
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on('data', (chunk: Buffer) => {
      file.write(chunk);
      for (const line of chunk.toString().split(/\r?\n/))
        if (line.trim()) console.log(`[${name}] ${line}`);
    });
  }
}

/** Stops a child we started: its own PID (and, on Windows, the tree under that PID). */
function stopChild(child: ChildProcess | undefined, tree: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null || !child.pid)
      return resolve();
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 8_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    if (tree && process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  });
}

async function main(): Promise<void> {
  mkdirSync(STATE_DIR, { recursive: true });
  if (flags.has('--stop')) {
    writeFileSync(STOP_FILE, String(Date.now()));
    log('asked the running stack to stop');
    return;
  }
  rmSync(STOP_FILE, { force: true });

  if (!flags.has('--no-build')) {
    log('building contracts, payment-qr, the API and the SDK (its simulated merchant)');
    run('npm', [
      'run',
      'build',
      '-w',
      '@midpoint/contracts',
      '-w',
      '@midpoint/payment-qr',
      '-w',
      '@midpoint/api',
      '-w',
      '@midpoint/sdk',
    ]);
  }
  const dev = await import('@midpoint/api/dev');

  for (const [port, what] of [
    [API_PORT, 'the API'],
    [WEB_PORT, 'the web app'],
  ] as const) {
    if (!(await portFree(port)))
      throw new Error(
        `port ${port} (${what}) is in use: stop whatever holds it, or pick another port`,
      );
  }

  if (flags.has('--reset')) {
    log('--reset: starting over');
    rmSync(STACK_FILE, { force: true });
    rmSync(MERCHANTS_FILE, { force: true });
  }
  let state: StackState | null = existsSync(STACK_FILE)
    ? (JSON.parse(readFileSync(STACK_FILE, 'utf8')) as StackState)
    : null;

  // --- Postgres ---------------------------------------------------------------
  let databaseUrl: string;
  let stopPostgres: () => Promise<void>;
  const docker = dev.dockerAnswers();
  if (docker) {
    log(`Postgres: docker compose on ${PG_PORT} (the Docker daemon answered)`);
    const env = { ...process.env, DEV_STACK_PG_PORT: String(PG_PORT) };
    run(
      'docker',
      ['compose', '-f', 'docker-compose.dev.yml', 'up', '-d', '--wait', 'postgres'],
      env,
    );
    databaseUrl = `postgresql://midpoint:midpoint@127.0.0.1:${PG_PORT}/midpoint`;
    stopPostgres = async () =>
      run('docker', ['compose', '-f', 'docker-compose.dev.yml', 'stop', 'postgres'], env);
  } else {
    log(
      `Postgres: embedded on ${PG_PORT} (no Docker daemon answered; Docker is never started from here)`,
    );
    if (!(await portFree(PG_PORT))) throw new Error(`port ${PG_PORT} (Postgres) is in use`);
    const pg = await dev.startEmbeddedPostgres({
      dataDir: join(STATE_DIR, 'pg'),
      port: PG_PORT,
      database: 'midpoint',
      persistent: true,
    });
    databaseUrl = pg.databaseUrl;
    stopPostgres = pg.stop;
  }

  // --- Stellar ------------------------------------------------------------------
  let stopStellar: () => void = () => undefined;
  let chain: DevChain;
  if (docker && !flags.has('--testnet')) {
    log('Stellar: the local network (stellar container start local)');
    const local = await dev.startLocalStellar();
    stopStellar = local.stop;
    chain = dev.devChain('local', {
      rpcUrl: local.rpcUrl,
      horizonUrl: local.horizonUrl,
      friendbotUrl: local.friendbotUrl,
    });
  } else {
    log('Stellar: testnet with friendbot (no Docker daemon answered)');
    chain = dev.devChain('testnet');
  }
  if (state && state.chain.network !== chain.network) {
    log(
      `the saved stack is on ${state.chain.network}, this run is on ${chain.network}: starting over`,
    );
    state = null;
  }
  if (state) {
    const server = await dev.rpcFor(chain.rpcUrl, chain.passphrase);
    const gone = await server.getContractInstance(state.market.contract).then(
      () => false,
      () => true,
    );
    if (gone) {
      log('the saved market is gone from the network (reset or archived): starting over');
      state = null;
    }
  }

  let api: ChildProcess | undefined;
  let web: ChildProcess | undefined;
  const bots = new Map<string, ChildProcess>();
  let stopping = false;
  let watcher: NodeJS.Timeout | undefined;
  let prices: NodeJS.Timeout | undefined;
  const shutdown = async (reason: string, code = 0) => {
    if (stopping) return;
    stopping = true;
    log(`stopping (${reason})`);
    if (prices) clearInterval(prices);
    await Promise.all([...bots.values()].map((bot) => stopChild(bot, false)));
    await stopChild(web, true);
    await stopChild(api, false);
    await stopPostgres().catch((err: unknown) => log(`Postgres stop: ${String(err)}`));
    stopStellar();
    rmSync(STOP_FILE, { force: true });
    if (watcher) clearInterval(watcher);
    log('stopped');
    process.exitCode = code;
  };
  process.on('SIGINT', () => void shutdown('Ctrl+C'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    // A stack whose seed never finished starts its database over (its keys and market stay).
    const fresh = !state?.seed;
    if (fresh) {
      log('resetting the database');
      await dev.resetDatabase(databaseUrl);
    }
    dev.migrate(databaseUrl);

    const accounts = state?.accounts ?? dev.newDevAccounts();
    const market =
      state?.market ?? (await dev.setUpDevMarket(chain, accounts, { log: (m) => log(m) }));
    // A market deployed before XLM was listed: its owner allows the native lumen's SAC now,
    // before the API checks which tokens the contract allows.
    await dev.allowNativeToken(chain, accounts.owner, market.contract).then(
      (changed) => {
        if (changed) log('the market now allows the native lumen (XLM)');
      },
      (err: unknown) => log(`XLM could not be allowed on the market (left out): ${String(err)}`),
    );
    const dataEncryptionKey = state?.dataEncryptionKey ?? randomBytes(32).toString('hex');
    const env = dev.localApiEnv({
      port: API_PORT,
      databaseUrl,
      chain,
      market,
      accounts,
      dataEncryptionKey,
      webOrigin: WEB_ORIGIN,
    });
    writeFileSync(
      join(STATE_DIR, 'api.env'),
      Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n',
    );
    if (!state) {
      // Persist the keys before anything else can fail: they hold testnet funds.
      writeFileSync(
        STACK_FILE,
        JSON.stringify({ chain, accounts, market, dataEncryptionKey }, null, 2),
      );
    }

    log(`API on ${API_URL}`);
    api = spawn(process.execPath, [join(ROOT, 'apps', 'api', 'dist', 'main.js')], {
      cwd: join(ROOT, 'apps', 'api'),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    pipeOutput(api, 'api');
    await waitFor(`${API_URL}/health`, 60);

    let seed: SeedResult;
    if (fresh || !state?.seed) {
      log('seeding through the API (on testnet this takes a few minutes)');
      seed = await dev.seedDevMarket({
        apiUrl: API_URL,
        webOrigin: WEB_ORIGIN,
        chain,
        market,
        accounts,
        log: (m) => log(m),
      });
      state = { chain, accounts, market, dataEncryptionKey, seed };
      writeFileSync(STACK_FILE, JSON.stringify(state, null, 2));
    } else {
      seed = state.seed;
    }
    const resumed = !fresh;

    const webPackage = join(ROOT, 'apps', 'web', 'package.json');
    const webDev =
      existsSync(webPackage) &&
      Boolean(
        (JSON.parse(readFileSync(webPackage, 'utf8')) as { scripts?: Record<string, string> })
          .scripts?.dev,
      );
    if (flags.has('--no-web')) {
      log('web app: skipped (--no-web)');
    } else if (!webDev) {
      log('web app: skipped (apps/web has no dev script here)');
    } else {
      log(`web app on ${WEB_ORIGIN}`);
      web = spawn('npm', ['run', 'dev'], {
        cwd: join(ROOT, 'apps', 'web'),
        env: {
          ...process.env,
          PORT: String(WEB_PORT),
          MIDPOINT_API_URL: API_URL,
          API_URL,
          VITE_API_URL: API_URL,
          PUBLIC_API_URL: API_URL,
          // The local stack serves only the test tier: the web (and Pollar's network) follow it.
          VITE_APP_TIER: process.env.VITE_APP_TIER || 'test',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        windowsHide: true,
      });
      pipeOutput(web, 'web');
    }

    watcher = setInterval(() => {
      if (existsSync(STOP_FILE)) void shutdown('stop requested');
      if (api && api.exitCode !== null) void shutdown(`the API exited with ${api.exitCode}`, 1);
    }, 1_000);

    if (resumed) {
      // A stack seeded earlier catches up (idempotent): what the seeded merchant lacks, its
      // offers in a token no longer listed deactivated, its liquidity, the user's dollars and
      // the charge's token. The web is already up meanwhile.
      try {
        const synced = await dev.syncDevSeed({
          apiUrl: API_URL,
          webOrigin: WEB_ORIGIN,
          chain,
          market,
          accounts,
          seed,
          log: (m) => log(m),
        });
        if (synced !== seed) {
          seed = synced;
          writeFileSync(
            STACK_FILE,
            JSON.stringify({ chain, accounts, market, dataEncryptionKey, seed }, null, 2),
          );
        }
      } catch (err) {
        log(`the seed could not be synced (a restart retries): ${String(err)}`);
      }
      const n = await dev.refreshDevPrices(API_URL, WEB_ORIGIN, seed.merchant.apiKey);
      log(`resumed; refreshed ${n} offer prices`);
    }

    // --- live prices and the automated test merchants ----------------------------
    const plog = (m: string) => console.log(`[prices] ${m}`);
    const mlog = (m: string) => console.log(`[merchants] ${m}`);
    const feed = new dev.PriceFeed({ log: plog });
    await feed.refresh();
    plog(feed.describe());
    const previous = existsSync(MERCHANTS_FILE)
      ? (JSON.parse(readFileSync(MERCHANTS_FILE, 'utf8')) as BotMerchant[])
      : null;
    if (!previous || !previous.every(dev.botMerchantReady)) {
      mlog('setting up the automated test merchants (on testnet the first run takes minutes)');
    }
    const merchants = await dev
      .setUpBotMerchants({
        apiUrl: API_URL,
        webOrigin: WEB_ORIGIN,
        chain,
        market,
        accounts,
        feed,
        previous,
        freshDatabase: fresh,
        save: (list) => writeFileSync(MERCHANTS_FILE, JSON.stringify(list, null, 2)),
        log: mlog,
      })
      .catch((err: unknown): BotMerchant[] => {
        mlog(`not set up (the stack runs without them; a restart retries): ${String(err)}`);
        return [];
      });
    const ready = merchants.filter(dev.botMerchantReady);
    if (stopping) return;

    const startBot = (m: BotMerchant): void => {
      if (stopping || !m.api) return;
      const bot = spawn(process.execPath, [BOT_ENTRY], {
        cwd: ROOT,
        env: {
          ...process.env,
          MIDPOINT_API_URL: API_URL,
          MIDPOINT_API_KEY: m.api.apiKey,
          BOT_SECRET: m.secret,
          MARKET_CONTRACT: `${chain.network}=${market.contract}`,
          BOT_NAME: m.displayName,
          PAY_DELAY_SECONDS: '5',
          RELEASE_DELAY_SECONDS: '5',
          POLL_SECONDS: '3',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      pipeOutput(bot, `bot-${m.slug}`);
      bots.set(m.slug, bot);
      bot.once('exit', (exitCode) => {
        if (stopping) return;
        mlog(`${m.displayName}'s bot exited (${exitCode}): restarting it in 5 s`);
        setTimeout(() => startBot(m), 5_000);
      });
    };
    if (!existsSync(BOT_ENTRY)) {
      mlog(`no bots: ${BOT_ENTRY} is missing (build the SDK: npm run build -w @midpoint/sdk)`);
    } else {
      for (const m of ready) startBot(m);
    }

    // Every minute: read the references again, then reprice the four merchants' offers.
    const priced = [
      {
        name: 'Oriente Cambio (seeded)',
        apiKey: seed.merchant.apiKey,
        spreadBps: dev.SEEDED_MERCHANT_SPREAD_BPS,
      },
      ...ready.map((m) => ({
        name: m.displayName,
        apiKey: m.api?.apiKey ?? '',
        spreadBps: m.spreadBps,
      })),
    ];
    const priceApi = new dev.DevApi(API_URL, WEB_ORIGIN);
    let pricing = false;
    const reprice = async (refresh: boolean): Promise<void> => {
      if (pricing || stopping) return;
      pricing = true;
      try {
        if (refresh) await feed.refresh();
        const total = { priced: 0, kept: 0, failed: 0 };
        for (const p of priced) {
          const r = await dev
            .refreshOfferPrices(priceApi, p.apiKey, feed, p.spreadBps)
            .catch((err: unknown) => {
              plog(`${p.name}: offers not repriced: ${String(err)}`);
              return { priced: 0, kept: 0, failed: 1 };
            });
          total.priced += r.priced;
          total.kept += r.kept;
          total.failed += r.failed;
        }
        plog(
          `${feed.describe()} | ${total.priced} offers repriced, ${total.kept} kept, ${total.failed} failed`,
        );
      } finally {
        pricing = false;
      }
    };
    await reprice(false);
    prices = setInterval(() => void reprice(true), PRICE_EVERY_MS);

    const explorer =
      chain.network === 'testnet' ? 'https://stellar.expert/explorer/testnet' : '(none on local)';
    const dollar = dev.devDollar(chain, market);
    const percent = (bps: number) => `${(bps / 100).toFixed(2)} %`;
    const lines = [
      '',
      '================ Midpoint dev stack ================',
      `API            ${API_URL}   (OpenAPI: /v1/openapi.json)`,
      `Market         ${API_URL}/v1/market?tier=test`,
      `Web app        ${webDev && !flags.has('--no-web') ? WEB_ORIGIN : '(not started)'}`,
      `Charge page    ${seed.charge.url}`,
      `Stellar        ${chain.network}   RPC ${chain.rpcUrl}`,
      `Explorer       ${explorer}`,
      `P2PMarket      ${market.contract}`,
      `${dollar.symbol.padEnd(15)}${dollar.asset.getCode()}:${dollar.asset.getIssuer()}  (SAC ${dollar.contract}; ${
        dollar.source === 'dex'
          ? "Circle's, bought with test lumens on the DEX"
          : 'the dev dollar, minted'
      })`,
      'XLM            the native lumen, through its SAC (no trustline)',
      `Prices         live mainnet references; offers repriced every ${PRICE_EVERY_MS / 1000} s`,
      '',
      'API keys (test tier):',
      `  merchant  ${seed.merchant.apiKey}`,
      `  business  ${seed.business.apiKey}`,
      ...ready.map((m) => `  ${m.slug.padEnd(8)}  ${m.api?.apiKey ?? ''}`),
      '',
      'Merchants (spread each way; the bots accept, mark paid and release 5 s later):',
      `  Oriente Cambio   ${percent(dev.SEEDED_MERCHANT_SPREAD_BPS)}  the seeded "merchant" above, manual (npm run dev:simulate)`,
      ...merchants.map(
        (m) =>
          `  ${m.displayName.padEnd(13)}  ${percent(m.spreadBps)}  ${m.publicKey}  ${m.secret}  ` +
          (dev.botMerchantReady(m)
            ? `bot on; liquidity ${Object.entries(m.liquidity ?? {})
                .map(([symbol, units]) => `${(BigInt(units) / 10_000_000n).toString()} ${symbol}`)
                .join(', ')}`
            : 'set-up unfinished: restart the stack to resume it'),
      ),
      `  Their keys and set-up: ${MERCHANTS_FILE} (test keys, ${chain.network.toUpperCase()} ONLY)`,
      '',
      `Dev accounts (${chain.network.toUpperCase()} ONLY: these are test keys, never use them on mainnet):`,
      ...Object.values(accounts).map((a) => `  ${a.role.padEnd(9)} ${a.publicKey}  ${a.secret}`),
      '',
      'Sign in on the web with a dev key (the web’s dev-key wallet), e.g. the "user" secret above:',
      `it holds ${dollar.symbol}, its account was created and its trustline opened by the sponsor.`,
      '',
      'Simulate a bank transfer for an order:',
      `  npm run dev:simulate -- <orderId> --api ${API_URL}`,
      '',
      'Stop: Ctrl+C here, or `npm run dev:stack -- --stop` from another terminal.',
      '===================================================',
      '',
    ];
    console.log(lines.join('\n'));
  } catch (err) {
    console.error(err);
    await shutdown('error', 1);
  }
}

void main();
