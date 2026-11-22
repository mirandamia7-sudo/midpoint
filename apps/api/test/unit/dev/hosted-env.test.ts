import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '@/config/env';
import { HOSTED_PROXY_HOPS, hostedApiEnv } from '@/dev/hosted-env';
import { devChain, newDevAccounts, type DevMarket } from '@/dev/stellar-dev';

const ORIGIN = 'https://midpoint-web.up.railway.app';
const market: DevMarket = {
  contract: StrKey.encodeContract(Buffer.alloc(32, 7)),
  startLedger: 1234,
  tusd: {
    code: 'TUSD',
    issuer: Keypair.random().publicKey(),
    contract: StrKey.encodeContract(Buffer.alloc(32, 8)),
  },
  feeBps: 50,
};
const input = {
  origin: ORIGIN,
  port: 4000,
  databaseUrl: 'postgresql://u:p@postgres.railway.internal:5432/railway',
  chain: devChain('testnet'),
  market,
  accounts: newDevAccounts(),
  dataEncryptionKey: 'cd'.repeat(32),
};

describe('a hosted test market', () => {
  it('runs as production on testnet, the config accepts it', () => {
    const env = hostedApiEnv(input);
    const config = loadConfig(env);
    expect(config.nodeEnv).toBe('production');
    expect(config.networks.testnet.contract).toBe(market.contract);
    expect(config.networks.testnet.tokens.map((t) => t.symbol)).toEqual(['USDC', 'XLM']);
    expect(config.app.tier).toBe('test');
    expect(config.sep10.network).toBe('testnet');
  });

  it('is one origin with the web: allowed origin, SEP-10 home domain and public URL', () => {
    const config = loadConfig(hostedApiEnv({ ...input, origin: `${ORIGIN}/app` }));
    expect(config.webOrigins).toEqual([ORIGIN]);
    expect(config.publicApiUrl).toBe(ORIGIN);
    expect(config.sep10.homeDomain).toBe('midpoint-web.up.railway.app');
    expect(config.cookieSecure).toBe(true);
    expect(config.trustProxy).toBe(HOSTED_PROXY_HOPS);
  });

  it('keeps the dev tools and the dev wallet keys out', () => {
    const env = hostedApiEnv(input);
    expect(env.DEV_TOOLS).toBe('false');
    expect(env.DEV_WALLET_SECRETS).toBeUndefined();
    expect(env.WEBHOOKS_ALLOW_INSECURE).toBe('false');
    expect(Object.values(env)).not.toContain(input.accounts.merchant.secret);
    expect(Object.values(env)).not.toContain(input.accounts.business.secret);
  });

  it('refuses another network or a plain http origin', () => {
    expect(() => hostedApiEnv({ ...input, chain: devChain('local') })).toThrow(/testnet/);
    expect(() => hostedApiEnv({ ...input, origin: 'http://example.com' })).toThrow(/https/);
  });
});
