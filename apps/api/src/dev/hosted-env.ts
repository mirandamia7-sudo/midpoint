import { localApiEnv } from '@/dev/local-env';
import type { DevAccounts, DevChain, DevMarket } from '@/dev/stellar-dev';

/** Hops in front of a hosted API: the platform's edge, then the web's reverse proxy. */
export const HOSTED_PROXY_HOPS = 2;

/**
 * The API's environment for a hosted test market: a temporary deployment on
 * testnet (the `test` tier) that people reach from the internet, apart from
 * the local stack (its own keys, market and database). It is the local
 * stack's environment ({@link localApiEnv}) made fit to face the internet:
 *
 * - production: no dev tools and no dev wallet keys, secure cookies, no
 *   insecure webhooks;
 * - one origin with the web: the web's server serves the app and passes
 *   `/v1/*` and `/.well-known/*` to the API (the web calls its own origin), so
 *   the allowed origin, the SEP-10 home domain and the public URL are the
 *   web's, and the client's address comes through two proxies;
 * - a room on one network can sign up together: the sponsor's per-IP limits
 *   are raised (it spends testnet lumens only).
 *
 * Testnet only: production refuses the local network, and a hosted market is
 * never mainnet.
 */
export function hostedApiEnv(input: {
  /** The web's public origin (https). */
  origin: string;
  port: number;
  databaseUrl: string;
  chain: DevChain;
  market: DevMarket;
  accounts: DevAccounts;
  dataEncryptionKey: string;
}): Record<string, string> {
  if (input.chain.network !== 'testnet') {
    throw new Error(`a hosted test market runs on testnet, not ${input.chain.network}`);
  }
  const url = new URL(input.origin);
  if (url.protocol !== 'https:')
    throw new Error(`the hosted origin must be https: ${input.origin}`);
  const origin = url.origin;
  const local = localApiEnv({ ...input, webOrigin: origin });
  const env: Record<string, string> = { ...local };
  delete env.DEV_WALLET_SECRETS;
  return {
    ...env,
    NODE_ENV: 'production',
    // Reached over the platform's private network (IPv6 included).
    HOST: '::',
    PUBLIC_API_URL: origin,
    COOKIE_SECURE: 'true',
    TRUST_PROXY: String(HOSTED_PROXY_HOPS),
    DEV_TOOLS: 'false',
    WEBHOOKS_ALLOW_INSECURE: 'false',
    JOB_INTERVAL_MS: '2000',
    WEBHOOK_INTERVAL_MS: '2000',
    SPONSOR_ACTIVATIONS_PER_IP_PER_DAY: '200',
    SPONSOR_IP_LIMIT_PER_HOUR: '3000',
  };
}
