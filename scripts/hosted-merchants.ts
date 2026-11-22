/**
 * The automated merchants of a hosted test market (the `merchants` service,
 * deploy/railway/README.md): one SDK simulated-merchant bot per merchant
 * (it accepts, marks paid and releases a few seconds later), restarted when it
 * exits, and every minute their offers repriced from the live references, as
 * the local stack does (scripts/dev-stack.ts).
 *
 * Environment: MIDPOINT_API_URL (the API), WEB_ORIGIN (the web's origin),
 * MARKET_CONTRACT (`testnet=C…`) and HOSTED_MERCHANTS (JSON written by
 * `npm run hosted -- seed`: name, apiKey, secret and spreadBps per merchant;
 * TEST keys). Each bot gets only its own key.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOT_ENTRY = join(ROOT, 'packages', 'sdk', 'dist', 'bot', 'simulated-merchant.js');
const PRICE_EVERY_MS = 60_000;
const RESTART_MS = 5_000;

interface HostedMerchant {
  name: string;
  apiKey: string;
  secret: string;
  spreadBps: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const log = (m: string) => console.log(`[merchants] ${m}`);

async function main(): Promise<void> {
  const apiUrl = required('MIDPOINT_API_URL');
  const origin = required('WEB_ORIGIN');
  const contract = required('MARKET_CONTRACT');
  if (!contract.startsWith('testnet=')) throw new Error('MARKET_CONTRACT must be testnet=C…');
  const merchants = JSON.parse(required('HOSTED_MERCHANTS')) as HostedMerchant[];
  // The bots inherit the environment without the other merchants' keys.
  const base: NodeJS.ProcessEnv = { ...process.env };
  delete base.HOSTED_MERCHANTS;

  const bots = new Map<string, ChildProcess>();
  let stopping = false;
  const start = (m: HostedMerchant): void => {
    if (stopping) return;
    const bot = spawn(process.execPath, [BOT_ENTRY], {
      cwd: ROOT,
      env: {
        ...base,
        MIDPOINT_API_URL: apiUrl,
        MIDPOINT_API_KEY: m.apiKey,
        BOT_SECRET: m.secret,
        MARKET_CONTRACT: contract,
        BOT_NAME: m.name,
        PAY_DELAY_SECONDS: '5',
        RELEASE_DELAY_SECONDS: '5',
        POLL_SECONDS: '3',
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    bots.set(m.name, bot);
    bot.once('exit', (code) => {
      if (stopping) return;
      log(`${m.name}'s bot exited (${code}): restarting it in ${RESTART_MS / 1000} s`);
      setTimeout(() => start(m), RESTART_MS);
    });
  };
  for (const m of merchants) start(m);
  log(`${merchants.length} bots on: ${merchants.map((m) => m.name).join(', ')}`);

  const dev = await import('@midpoint/api/dev');
  const feed = new dev.PriceFeed({ log });
  const api = new dev.DevApi(apiUrl, origin);
  let pricing = false;
  const reprice = async (): Promise<void> => {
    if (pricing || stopping) return;
    pricing = true;
    try {
      await feed.refresh();
      const total = { priced: 0, kept: 0, failed: 0 };
      for (const m of merchants) {
        const r = await dev
          .refreshOfferPrices(api, m.apiKey, feed, m.spreadBps)
          .catch((err: unknown) => {
            log(`${m.name}: offers not repriced: ${String(err)}`);
            return { priced: 0, kept: 0, failed: 1 };
          });
        total.priced += r.priced;
        total.kept += r.kept;
        total.failed += r.failed;
      }
      log(
        `${feed.describe()} | ${total.priced} repriced, ${total.kept} kept, ${total.failed} failed`,
      );
    } catch (err) {
      log(`prices not refreshed (next minute retries): ${String(err)}`);
    } finally {
      pricing = false;
    }
  };
  await reprice();
  const timer = setInterval(() => void reprice(), PRICE_EVERY_MS);

  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`stopping (${signal})`);
    clearInterval(timer);
    for (const bot of bots.values()) bot.kill('SIGTERM');
    setTimeout(() => process.exit(0), 2_000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
