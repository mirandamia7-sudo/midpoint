import { describe, expect, it, vi } from 'vitest';
import type { DevApi } from '@/dev/dev-api';
import {
  APPROX_USD,
  PRICE_CURRENCIES,
  PriceFeed,
  criptoYaMid,
  fxRate,
  offerPrice,
  orderBookMid,
  refreshOfferPrices,
  xlmUsdcBookUrl,
  type FetchLike,
} from '@/dev/price-feed';
import { P2P_CURRENCY_CODES } from '@/p2p/domain/constants';

const NOW = 1_795_167_600;

/** A CriptoYa answer: per exchange ask / bid / time. */
function criptoYa(quotes: Record<string, [number, number, number?]>): unknown {
  return Object.fromEntries(
    Object.entries(quotes).map(([exchange, [ask, bid, time]]) => [
      exchange,
      { ask, totalAsk: ask * 1.01, bid, totalBid: bid * 0.99, time: time ?? NOW - 30 },
    ]),
  );
}

/** A Horizon order book of XLM/USDC. */
function book(bids: [string, string][], asks: [string, string][]): unknown {
  return {
    bids: bids.map(([price, amount]) => ({ price, amount })),
    asks: asks.map(([price, amount]) => ({ price, amount })),
    base: { asset_type: 'native' },
  };
}

const FX = {
  result: 'success',
  base_code: 'USD',
  rates: {
    ARS: 1562.98,
    BOB: 6.91,
    BRL: 5.89,
    CLP: 1007.79,
    COP: 3345.39,
    MXN: 19.03,
    PEN: 3.43,
  },
};

/** A fetch that answers from `routes` (by URL prefix) and fails the rest; it records every URL. */
function fakeFetch(routes: Record<string, unknown | Error>) {
  const urls: string[] = [];
  const fn: FetchLike = async (url) => {
    urls.push(url);
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    const answer = key === undefined ? new Error('unreachable') : routes[key];
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  return { fn, urls };
}

const allCriptoYa = (mid: number) =>
  Object.fromEntries(
    ['bob', 'ars', 'brl', 'clp', 'cop', 'mxn', 'pen'].map((c) => [
      `https://criptoya.com/api/usdt/${c}/1`,
      criptoYa({ a: [mid + 1, mid - 1], b: [mid + 2, mid - 2] }),
    ]),
  );

describe('the priced currencies', () => {
  it('are every currency the market lists, bolivianos first', () => {
    expect(PRICE_CURRENCIES).toEqual(P2P_CURRENCY_CODES);
    expect(PRICE_CURRENCIES[0]).toBe('BOB');
  });

  it('each have a rough reference for a merchant’s first offers (BOB about 11.9)', () => {
    for (const currency of PRICE_CURRENCIES) expect(APPROX_USD[currency]).toBeGreaterThan(0);
    expect(APPROX_USD.BOB).toBeCloseTo(11.9, 1);
  });
});

describe('criptoYaMid', () => {
  it('is the median of the exchanges’ mid prices', () => {
    const body = criptoYa({
      ripio: [1749.58, 1702.66],
      binancep2p: [1736, 1725.01],
      letsbit: [1734.83, 1701.13],
    });
    // mids 1726.12, 1730.505, 1717.98 → median 1726.12
    expect(criptoYaMid(body, NOW)).toBeCloseTo(1726.12, 6);
  });

  it('leaves out crossed books, stale quotes and empty sides', () => {
    const body = criptoYa({
      good: [19.2, 18.94],
      crossed: [19.2, 24.51],
      stale: [30, 29, NOW - 3 * 24 * 3600],
      empty: [0, 0],
    });
    expect(criptoYaMid(body, NOW)).toBeCloseTo(19.07, 6);
  });

  it('is null for an answer with no usable quote, or that is not an object', () => {
    expect(criptoYaMid(criptoYa({ crossed: [10, 20] }), NOW)).toBeNull();
    expect(criptoYaMid([], NOW)).toBeNull();
    expect(criptoYaMid('error', NOW)).toBeNull();
  });
});

describe('fxRate', () => {
  it('reads one currency per US dollar, only from a successful USD answer', () => {
    expect(fxRate(FX, 'CLP')).toBe(1007.79);
    expect(fxRate({ ...FX, result: 'error' }, 'CLP')).toBeNull();
    expect(fxRate({ ...FX, base_code: 'EUR' }, 'CLP')).toBeNull();
    expect(fxRate(FX, 'XYZ')).toBeNull();
  });
});

describe('orderBookMid', () => {
  it('is the mid of the best bid and ask, skipping dust levels', () => {
    const body = book(
      [
        ['0.1326920', '0.0005837'],
        ['0.1326140', '530.4560000'],
      ],
      [['0.1327996', '499.7120654']],
    );
    expect(orderBookMid(body)).toBeCloseTo((0.132614 + 0.1327996) / 2, 9);
  });

  it('is null for an empty, crossed or too wide book', () => {
    expect(orderBookMid(book([], [['0.13', '10']]))).toBeNull();
    expect(orderBookMid(book([['0.14', '10']], [['0.13', '10']]))).toBeNull();
    expect(orderBookMid(book([['0.10', '10']], [['0.13', '10']]))).toBeNull();
    expect(orderBookMid(null)).toBeNull();
  });

  it('reads Circle’s mainnet USDC book from the public Horizon', () => {
    const url = new URL(xlmUsdcBookUrl());
    expect(url.origin).toBe('https://horizon.stellar.org');
    expect(url.searchParams.get('selling_asset_type')).toBe('native');
    expect(url.searchParams.get('buying_asset_code')).toBe('USDC');
    expect(url.searchParams.get('buying_asset_issuer')).toBe(
      'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    );
  });
});

describe('offerPrice', () => {
  it('sells above the reference and buys below it, by the spread each way', () => {
    expect(offerPrice(1000, 'SELL_TOKEN', 90)).toBe('1009');
    expect(offerPrice(1000, 'BUY_TOKEN', 90)).toBe('991');
  });

  it('keeps at most six decimals', () => {
    expect(offerPrice(0.1327 * 5.9, 'SELL_TOKEN', 60)).toBe('0.787628');
    expect(offerPrice(1734.123456789, 'BUY_TOKEN', 0)).toBe('1734.123457');
  });
});

describe('PriceFeed', () => {
  const at = new Date(NOW * 1000);

  it('prices USD tokens at the dollar rate and the lumen at XLM/USD times it', async () => {
    const { fn, urls } = fakeFetch({
      ...allCriptoYa(1000),
      'https://horizon.stellar.org/order_book': book([['0.1320', '500']], [['0.1340', '500']]),
    });
    const feed = new PriceFeed({ fetch: fn, now: () => at });
    await feed.refresh();
    expect(feed.reference('USDC', 'ARS')).toBe(1000);
    expect(feed.reference('TUSD', 'ARS')).toBe(1000);
    expect(feed.reference('XLM', 'ARS')).toBeCloseTo(133, 9);
    expect(feed.reference('EURC', 'ARS')).toBeNull();
    // The FX fallback is not asked when CriptoYa answers every currency.
    expect(urls.some((u) => u.includes('open.er-api'))).toBe(false);
    expect(feed.describe()).toContain('XLM→USD 0.133');
  });

  it('reads bolivianos from CriptoYa’s USDT/BOB quotes', async () => {
    const routes = allCriptoYa(1000);
    routes['https://criptoya.com/api/usdt/bob/1'] = criptoYa({
      binancep2p: [11.98, 11.92],
      bybitp2p: [11.99, 11.93],
      eldorado: [12.01, 11.9],
    });
    const { fn, urls } = fakeFetch({
      ...routes,
      'https://horizon.stellar.org': book([['0.1320', '500']], [['0.1340', '500']]),
    });
    const feed = new PriceFeed({ fetch: fn, now: () => at });
    const snapshot = await feed.refresh();
    expect(urls).toContain('https://criptoya.com/api/usdt/bob/1');
    // mids 11.95, 11.96, 11.955 → median 11.955
    expect(snapshot.usd.BOB?.source).toBe('criptoya');
    expect(snapshot.usd.BOB?.value).toBeCloseTo(11.955, 9);
    expect(feed.reference('USDC', 'BOB')).toBeCloseTo(11.955, 9);
    expect(feed.reference('XLM', 'BOB')).toBeCloseTo(0.133 * 11.955, 9);
    expect(feed.describe()).toMatch(/^USD→ BOB 11\.9\d PEN 1000 /);
  });

  it('falls back to the FX API for a currency CriptoYa lacks', async () => {
    const routes = allCriptoYa(1000);
    routes['https://criptoya.com/api/usdt/clp/1'] = criptoYa({});
    const { fn } = fakeFetch({
      ...routes,
      'https://open.er-api.com': FX,
      'https://horizon.stellar.org': book([['0.13', '5']], [['0.13', '5']]),
    });
    const log = vi.fn();
    const feed = new PriceFeed({ fetch: fn, log, now: () => at });
    const snapshot = await feed.refresh();
    expect(snapshot.usd.CLP).toMatchObject({ value: 1007.79, source: 'open.er-api' });
    expect(snapshot.usd.ARS).toMatchObject({ value: 1000, source: 'criptoya' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('USD/CLP (criptoya)'));
    expect(feed.describe()).toContain('CLP 1007.79*');
  });

  it('keeps the last good price when a source fails, and logs it', async () => {
    let up = true;
    const fn: FetchLike = async (url) => {
      if (!up) throw new Error('timeout');
      if (url.startsWith('https://horizon.stellar.org')) {
        return Response.json(book([['0.134', '5']], [['0.136', '5']]));
      }
      return Response.json(criptoYa({ a: [1010, 990] }));
    };
    const log = vi.fn();
    let now = at;
    const feed = new PriceFeed({ fetch: fn, log, now: () => now });
    await feed.refresh();
    up = false;
    now = new Date(at.getTime() + 60_000);
    const snapshot = await feed.refresh();
    expect(snapshot.usd.ARS?.value).toBe(1000);
    expect(snapshot.xlmUsd?.value).toBeCloseTo(0.135, 9);
    expect(feed.reference('XLM', 'BRL')).toBeCloseTo(135, 9);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/XLM\/USD: timeout; keeping 0.135/));
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/USD\/ARS \(criptoya\): timeout; keeping/),
    );
  });

  it('never throws, and prices nothing before any source answered', async () => {
    const { fn } = fakeFetch({});
    const feed = new PriceFeed({ fetch: fn, now: () => at });
    await expect(feed.refresh()).resolves.toEqual({ usd: {}, xlmUsd: null });
    expect(feed.reference('USDC', 'ARS')).toBeNull();
    expect(feed.reference('XLM', 'ARS')).toBeNull();
  });
});

describe('refreshOfferPrices', () => {
  const offers = [
    {
      id: 'o1',
      side: 'SELL_TOKEN',
      tokenSymbol: 'USDC',
      currency: 'ARS',
      price: '1250',
      active: true,
    },
    {
      id: 'o2',
      side: 'BUY_TOKEN',
      tokenSymbol: 'XLM',
      currency: 'ARS',
      price: '200',
      active: true,
    },
    {
      id: 'o3',
      side: 'BUY_TOKEN',
      tokenSymbol: 'USDC',
      currency: 'MXN',
      price: '18.5',
      active: true,
    },
  ];

  it('reprices each offer with the spread and keeps (renews) what the feed cannot price', async () => {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const api = {
      call: vi.fn(async (method: string, path: string, _key: string, body?: unknown) => {
        calls.push({ method, path, body });
        return method === 'GET' ? { data: offers, total: offers.length } : {};
      }),
    } as unknown as DevApi;
    const feed = {
      reference: (symbol: string, currency: string) =>
        currency === 'ARS' ? (symbol === 'XLM' ? 230 : 1735) : null,
    };
    const result = await refreshOfferPrices(api, 'pk_test_x', feed, 100);
    expect(result).toEqual({ priced: 2, kept: 1, failed: 0 });
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([
      { method: 'PATCH', path: '/v1/p2p/offers/o1', body: { price: '1752.35' } },
      { method: 'PATCH', path: '/v1/p2p/offers/o2', body: { price: '227.7' } },
      { method: 'PATCH', path: '/v1/p2p/offers/o3', body: { price: '18.5' } },
    ]);
  });

  it('leaves deactivated offers alone (a token no longer traded is never repriced)', async () => {
    const listed = [
      ...offers,
      {
        id: 'tusd',
        side: 'SELL_TOKEN',
        tokenSymbol: 'CTUSD',
        currency: 'BOB',
        price: '12',
        active: false,
      },
    ];
    const patched: string[] = [];
    const api = {
      call: vi.fn(async (method: string, path: string) => {
        if (method === 'GET') return { data: listed, total: listed.length };
        patched.push(path);
        return {};
      }),
    } as unknown as DevApi;
    const result = await refreshOfferPrices(api, 'pk_test_x', { reference: () => 10 }, 50);
    expect(result).toEqual({ priced: 3, kept: 0, failed: 0 });
    expect(patched).not.toContain('/v1/p2p/offers/tusd');
  });

  it('counts an offer the API refuses, and goes on', async () => {
    const api = {
      call: vi.fn(async (method: string, path: string) => {
        if (method === 'GET') return { data: offers, total: offers.length };
        if (path.endsWith('o2')) throw new Error('400');
        return {};
      }),
    } as unknown as DevApi;
    const result = await refreshOfferPrices(api, 'pk_test_x', { reference: () => 10 }, 50);
    expect(result).toEqual({ priced: 2, kept: 0, failed: 1 });
  });
});
