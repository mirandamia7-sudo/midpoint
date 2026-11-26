import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  BOT_MERCHANTS,
  MATCHER_MAX_PER_ORDER,
  OFFER_MAX_USD,
  SEEDED_MERCHANT_SPREAD_BPS,
  botDollarTarget,
  botMerchantReady,
  botOffers,
  devMerchantTokens,
  type BotMerchant,
} from '@/dev/bot-merchants';
import { APPROX_USD, PRICE_CURRENCIES } from '@/dev/price-feed';
import { isP2pRailId, isQrRail, validateRailDetails } from '@/p2p/domain/rails';

const MARKET = StrKey.encodeContract(Buffer.alloc(32, 9));
const MERCHANT = Keypair.random().publicKey();
const U = 10_000_000n;

describe('the bot merchants', () => {
  it('are three distinct merchants with distinct spreads of 0.5 to 1.5 % each way', () => {
    expect(BOT_MERCHANTS.map((m) => m.displayName)).toEqual([
      'Andes Cambio',
      'Illimani Pagos',
      'Río Express',
    ]);
    const spreads = [...BOT_MERCHANTS.map((m) => m.spreadBps), SEEDED_MERCHANT_SPREAD_BPS];
    expect(new Set(spreads).size).toBe(spreads.length);
    for (const s of spreads) {
      expect(s).toBeGreaterThanOrEqual(50);
      expect(s).toBeLessThanOrEqual(150);
    }
    // The seeded (manual) merchant is the widest: the automated ones usually win.
    expect(Math.max(...spreads)).toBe(SEEDED_MERCHANT_SPREAD_BPS);
  });

  it('cover every currency the market lists (at least two each) and both QR rails', () => {
    for (const currency of PRICE_CURRENCIES) {
      const count = BOT_MERCHANTS.filter((m) =>
        m.methods.some((x) => x.currency === currency),
      ).length;
      expect(count, currency).toBeGreaterThanOrEqual(2);
    }
    const qr = new Set(BOT_MERCHANTS.flatMap((m) => m.qrRails));
    expect([...qr].sort()).toEqual(['ar_qr', 'br_pix_qr', 'pe_qr']);
    // Peru's QR (Yape, Plin, banks): the merchants that trade soles take it, and Illimani Pagos too.
    for (const merchant of BOT_MERCHANTS)
      expect(merchant.qrRails, merchant.slug).toContain('pe_qr');
  });

  it('all trade bolivianos first, by Bolivian bank transfer with a company NIT', () => {
    const banks = new Set<string>();
    for (const merchant of BOT_MERCHANTS) {
      const [first] = merchant.methods;
      expect(first, merchant.slug).toMatchObject({ currency: 'BOB', rail: 'bo_bank_transfer' });
      expect(first.details.documentType).toBe('NIT');
      expect(first.details.documentNumber).toMatch(/^\d{9,10}$/);
      expect(first.holderName).toMatch(/SRL$/);
      banks.add(first.details.bank);
    }
    expect(banks.size).toBe(BOT_MERCHANTS.length);
  });

  it('hold payment details every rail accepts (check digits included)', () => {
    for (const merchant of BOT_MERCHANTS) {
      for (const method of merchant.methods) {
        expect(isP2pRailId(method.rail)).toBe(true);
        if (!isP2pRailId(method.rail)) continue;
        const check = validateRailDetails(method.rail, method.currency, method.details);
        expect(check, `${merchant.slug} ${method.rail}`).toMatchObject({ ok: true });
      }
    }
  });
});

describe('botOffers', () => {
  const andes = BOT_MERCHANTS[0];
  const reference = (symbol: string, currency: string) =>
    currency === 'ARS' ? (symbol === 'XLM' ? 230 : 1735) : currency === 'CLP' ? 1010 : null;

  it('sells and buys every token on each account rail, and buys on its QR rails', () => {
    const offers = botOffers(andes, ['USDC', 'XLM'], reference);
    const perToken = andes.methods.length * 2 + andes.qrRails.length;
    expect(offers).toHaveLength(perToken * 2);
    const qr = offers.filter((o) => o.rails.some(isQrRail));
    expect(qr.every((o) => o.side === 'BUY_TOKEN')).toBe(true);
    expect(qr.map((o) => `${o.token} ${o.rails[0]}`)).toEqual([
      'USDC ar_qr',
      'USDC pe_qr',
      'XLM ar_qr',
      'XLM pe_qr',
    ]);
    // A Peru QR offer buys tokens in soles.
    expect(qr.find((o) => o.rails[0] === 'pe_qr')).toMatchObject({
      side: 'BUY_TOKEN',
      currency: 'PEN',
    });
    // Bolivia first: the first offers are the boliviano ones.
    expect(
      offers.slice(0, 2).map((o) => `${o.side} ${o.token} ${o.currency} ${o.rails[0]}`),
    ).toEqual(['SELL_TOKEN USDC BOB bo_bank_transfer', 'BUY_TOKEN USDC BOB bo_bank_transfer']);
  });

  it('prices around the reference with the merchant’s spread', () => {
    const offers = botOffers(andes, ['XLM'], reference);
    const ars = offers.filter((o) => o.currency === 'ARS' && o.rails[0] === 'ar_bank_transfer');
    expect(ars.find((o) => o.side === 'SELL_TOKEN')?.price).toBe('231.38');
    expect(ars.find((o) => o.side === 'BUY_TOKEN')?.price).toBe('228.62');
  });

  it('bounds orders from about one dollar to the token’s maximum, in local money', () => {
    const offers = botOffers(andes, ['USDC', 'XLM'], reference);
    const ars = offers.find((o) => o.token === 'USDC' && o.currency === 'ARS');
    expect(ars).toMatchObject({ minFiat: '1735.00', maxFiat: '3470000.00' });
    const clp = offers.find((o) => o.token === 'XLM' && o.currency === 'CLP');
    expect(clp).toMatchObject({ minFiat: '1010', maxFiat: '303000' });
  });

  it('prices and bounds bolivianos from the reference (two decimals)', () => {
    const bob = (symbol: string, currency: string) =>
      currency === 'BOB' ? (symbol === 'XLM' ? 1.58 : 11.95) : null;
    const offers = botOffers(andes, ['USDC', 'XLM'], bob);
    const usdc = offers.filter((o) => o.token === 'USDC' && o.currency === 'BOB');
    expect(usdc.map((o) => [o.side, o.price, o.minFiat, o.maxFiat])).toEqual([
      ['SELL_TOKEN', '12.0217', '11.95', '23900.00'],
      ['BUY_TOKEN', '11.8783', '11.95', '23900.00'],
    ]);
    const xlm = offers.find((o) => o.token === 'XLM' && o.currency === 'BOB');
    expect(xlm).toMatchObject({ price: '1.58948', minFiat: '11.95', maxFiat: '3585.00' });
  });

  it('uses rough references only while the feed has none (the price loop corrects them)', () => {
    const offers = botOffers(andes, ['USDC', 'XLM'], () => null);
    expect(offers.every((o) => Number(o.price) > 0)).toBe(true);
    const bob = offers.find((o) => o.token === 'USDC' && o.currency === 'BOB');
    expect(Number(bob?.price)).toBeCloseTo(APPROX_USD.BOB * 1.006, 4);
  });

  it('lets a dollar order reach 2 000 dollars, under the matcher’s per-order cap', () => {
    expect(OFFER_MAX_USD.USDC).toBe(2_000);
    expect(BigInt(OFFER_MAX_USD.USDC) * U).toBeLessThanOrEqual(MATCHER_MAX_PER_ORDER);
  });
});

describe('the bot merchants’ tokens and liquidity', () => {
  it('trade the network’s dollar and XLM, nothing else', () => {
    expect(devMerchantTokens({ symbol: 'USDC' })).toEqual(['USDC', 'XLM']);
    expect(devMerchantTokens({ symbol: 'TUSD' })).toEqual(['TUSD', 'XLM']);
  });

  it('aim at 5 000 USDC bought on the testnet DEX, or 200 000 minted TUSD locally', () => {
    expect(botDollarTarget({ source: 'dex' })).toBe(5_000n * U);
    expect(botDollarTarget({ source: 'mint' })).toBe(200_000n * U);
  });
});

describe('botMerchantReady', () => {
  const base: BotMerchant = {
    slug: 'andes',
    displayName: 'Andes Cambio',
    spreadBps: 60,
    publicKey: MERCHANT,
    secret: Keypair.random().secret(),
    network: 'testnet',
    market: MARKET,
  };

  it('is true only once every step is done', () => {
    expect(botMerchantReady(base)).toBe(false);
    const done: BotMerchant = {
      ...base,
      chain: { usdc: false },
      api: { organizationId: 'o', apiKey: 'pk_test_x', accountId: 'a' },
      offers: 27,
      liquidity: { USDC: '1' },
      matcher: true,
    };
    expect(botMerchantReady(done)).toBe(true);
    expect(botMerchantReady({ ...done, matcher: undefined })).toBe(false);
  });
});
