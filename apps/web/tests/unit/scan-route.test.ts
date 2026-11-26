/* scan-route.test.ts: what a scanned or pasted text opens (src/lib/app/scan-route.ts, on top of
   @midpoint/payment-qr), the dollars the app shows (src/lib/app/money.ts) and when a QR payment's
   quote is trusted (src/lib/p2p/qr-pay.ts). */
import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { buildPaymentLink, buildSep7Pay, emvCrc } from '@midpoint/payment-qr';
import { routeScan, sendPath, type ScanContext } from '@/lib/app/scan-route';
import {
  dollarsToUnits,
  isDollarToken,
  localValue,
  tokensForLocal,
  unitsToDecimal,
  usd,
  usdNumber,
} from '@/lib/app/money';
import { QR_PAY_WINDOWS, qrRail, trustQrQuote } from '@/lib/p2p/qr-pay';
import { arQr, pixQr } from '@/lib/mock/qr';
import { normalizeQuote } from '@/lib/p2p/normalize';
import { PASSPHRASES } from '@/lib/stellar/network';
import { pickToken } from '@/lib/app/token';

const ORIGIN = 'https://app.example';
const G = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const SECRET = 'SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR';
const CTX: ScanContext = {
  origins: [ORIGIN],
  token: { symbol: 'USDC', code: 'USDC', issuer: ISSUER },
  networkPassphrase: PASSPHRASES.testnet,
};
const tlv = (id: string, v: string) => `${id}${String(v.length).padStart(2, '0')}${v}`;
const withCrc = (body: string) => `${body}6304${emvCrc(`${body}6304`)}`;

describe('a scan opens the right screen', () => {
  test('an address or a handle: send to it', () => {
    assert.deepEqual(routeScan(G, CTX), { to: 'send', recipient: G, amount: null, note: null });
    assert.deepEqual(routeScan(' @Lucia ', CTX), {
      to: 'send',
      recipient: '@lucia',
      amount: null,
      note: null,
    });
  });
  test("this app's payment link, with its amount and note", () => {
    const link = buildPaymentLink(ORIGIN, {
      to: '@lucia',
      amount: '12.5',
      asset: 'USDC',
      note: 'Café',
    });
    const r = routeScan(link, CTX);
    assert.deepEqual(r, { to: 'send', recipient: '@lucia', amount: '12.5', note: 'Café' });
    assert.equal(
      sendPath(r as Extract<typeof r, { to: 'send' }>),
      '/app/send?to=%40lucia&amount=12.5&note=Caf%C3%A9',
    );
  });
  test('a payment link for another asset is refused', () =>
    assert.deepEqual(routeScan(buildPaymentLink(ORIGIN, { to: G, asset: 'EURC' }), CTX), {
      to: 'problem',
      problem: 'other-asset',
      asset: 'EURC',
    }));
  test("another site's link is never opened", () =>
    assert.deepEqual(routeScan('https://evil.example/app/send?to=%40lucia', CTX), {
      to: 'problem',
      problem: 'foreign-link',
    }));
  test('a charge link: pay the charge', () => {
    assert.deepEqual(routeScan(`${ORIGIN}/pay/ch_pedido1042`, CTX), {
      to: 'charge',
      chargeId: 'ch_pedido1042',
    });
    assert.deepEqual(routeScan(`${ORIGIN}/c/ch_pedido1042`, CTX), {
      to: 'charge',
      chargeId: 'ch_pedido1042',
    });
  });
  test("a shop's Argentine QR or PIX: pay it through a merchant", () => {
    const ar = arQr({ merchant: 'Cafe', city: 'Buenos Aires', amount: '100.00' });
    assert.deepEqual(routeScan(ar, CTX), { to: 'pay-qr', payload: ar });
    const pix = pixQr({ merchant: 'Padaria', city: 'SP', amount: null });
    assert.deepEqual(routeScan(pix, CTX), { to: 'pay-qr', payload: pix });
  });
  test('a merchant QR the market does not take, or a damaged one', () => {
    const mx = withCrc(
      tlv('00', '01') +
        tlv('26', tlv('00', 'mx.example.pay') + tlv('01', '123')) +
        tlv('53', '484') +
        tlv('58', 'MX') +
        tlv('59', 'Tienda') +
        tlv('60', 'CDMX'),
    );
    assert.deepEqual(routeScan(mx, CTX), { to: 'problem', problem: 'qr-not-taken' });
    const ar = arQr({ merchant: 'Cafe', city: 'Buenos Aires', amount: '100.00' });
    assert.deepEqual(routeScan(`${ar.slice(0, -1)}0`, CTX), {
      to: 'problem',
      problem: 'emv-invalid',
    });
  });
  test('a secret key: a warning, never a payment', () =>
    assert.deepEqual(routeScan(SECRET, CTX), { to: 'secret' }));
  test('a SEP-7 request for USDC: send, its text memo as the note', () =>
    assert.deepEqual(
      routeScan(
        buildSep7Pay({
          destination: G,
          amount: '5',
          assetCode: 'USDC',
          assetIssuer: ISSUER,
          memo: 'pedido 42',
          networkPassphrase: PASSPHRASES.testnet,
        }),
        CTX,
      ),
      { to: 'send', recipient: G, amount: '5', note: 'pedido 42' },
    ));
  test('SEP-7 refusals: XLM, a lookalike USDC, an ID memo, another network, a tx request', () => {
    assert.deepEqual(routeScan(buildSep7Pay({ destination: G, amount: '5' }), CTX), {
      to: 'problem',
      problem: 'other-asset',
      asset: 'XLM',
    });
    assert.equal(
      (
        routeScan(buildSep7Pay({ destination: G, assetCode: 'USDC', assetIssuer: G }), CTX) as {
          problem?: string;
        }
      ).problem,
      'other-asset',
    );
    assert.deepEqual(
      routeScan(
        `web+stellar:pay?destination=${G}&asset_code=USDC&asset_issuer=${ISSUER}&memo=123&memo_type=MEMO_ID`,
        CTX,
      ),
      { to: 'problem', problem: 'memo' },
    );
    assert.deepEqual(
      routeScan(
        buildSep7Pay({
          destination: G,
          assetCode: 'USDC',
          assetIssuer: ISSUER,
          networkPassphrase: PASSPHRASES.mainnet,
        }),
        CTX,
      ),
      { to: 'problem', problem: 'other-network' },
    );
    assert.deepEqual(routeScan('web+stellar:tx?xdr=AAAA', CTX), {
      to: 'problem',
      problem: 'sep7-tx',
    });
  });
  test('anything else is unknown', () => {
    assert.deepEqual(routeScan('hola', CTX), { to: 'problem', problem: 'unknown' });
    assert.deepEqual(routeScan('', CTX), { to: 'problem', problem: 'unknown' });
  });
});

describe('dollars as the app shows them', () => {
  test('two decimals, rounded down, in the reader language', () => {
    assert.equal(usdNumber('es', '2483500000'), '248,35');
    assert.equal(usdNumber('en', '2483599999'), '248.35', 'never shown bigger than it is');
    assert.equal(usdNumber('es', '12345678900000'), '1.234.567,89');
    assert.equal(usdNumber('en', '0'), '0.00');
    assert.equal(usdNumber('es', '50000000000'), '5.000,00', 'four digits are grouped too');
    assert.equal(usdNumber('en', '50000000000'), '5,000.00');
    assert.equal(usd('es', '125000000', 'US$ {amount}'), 'US$ 12,50');
    assert.equal(usd('en', '125000000', '${amount}'), '$12.50');
  });
  test('what a person types, to base units', () => {
    assert.equal(dollarsToUnits('12.5'), '125000000');
    assert.equal(dollarsToUnits('12,50'), '125000000');
    assert.equal(dollarsToUnits('0'), null);
    assert.equal(dollarsToUnits('1.234'), null, 'at most two decimals');
    assert.equal(dollarsToUnits('abc'), null);
    assert.equal(unitsToDecimal('125000000'), '12.5');
  });
  test('the local-money value at a price', () => {
    assert.equal(localValue('125000000', 1452, 'ARS'), '18150.00');
    assert.equal(localValue('125000000', 932, 'CLP'), '11650');
    assert.equal(localValue('x', 1452, 'ARS'), null);
    assert.equal(localValue('1', 0, 'ARS'), null);
  });
  test('an amount asked in local money, in tokens', () => {
    assert.equal(tokensForLocal('74', 3.7), '20.00', 'float noise adds no cent');
    assert.equal(tokensForLocal('100', 6.92), '14.46', 'rounded up: never less than asked');
    assert.equal(tokensForLocal('14520', 1452), '10.00');
    assert.equal(tokensForLocal('0.01', 1452), '0.01', 'a cent at least');
    assert.equal(tokensForLocal('0', 3.7), null);
    assert.equal(tokensForLocal('abc', 3.7), null);
    assert.equal(tokensForLocal('10', null), null);
    assert.equal(tokensForLocal('10', 0), null);
  });
});

describe('a QR payment quote is trusted only for the QR it was asked for', () => {
  const ar = { standard: 'ar-interoperable' as const, currency: 'ARS', amount: '12500.00' };
  const q = normalizeQuote({
    id: 'q',
    kind: 'QR_PAY',
    side: 'SELL',
    network: 'testnet',
    tokenSymbol: 'USDC',
    tokenDecimals: 7,
    currency: 'ARS',
    rail: 'ar_qr',
    price: '1452',
    fiatAmount: '12500.00',
    tokenAmount: '86088154',
    protocolFee: '258264',
    integratorFee: '0',
    netAmount: '85829890',
    expiresAt: '2026-11-19T12:00:00Z',
  });
  const asked = { network: 'testnet', token: 'USDC', qr: ar, fiatAmount: null };
  test('the rail follows the QR', () => {
    assert.equal(qrRail(ar), 'ar_qr');
    assert.equal(qrRail({ standard: 'pix', currency: 'BRL' }), 'br_pix_qr');
    assert.equal(qrRail({ standard: 'pe-interoperable', currency: 'PEN' }), 'pe_qr');
    assert.equal(qrRail({ standard: 'pe-interoperable', currency: 'USD' }), null);
    assert.equal(qrRail({ standard: 'pix', currency: 'ARS' }), null);
    assert.equal(qrRail({ standard: 'emv', currency: 'MXN' }), null);
    assert.deepEqual(QR_PAY_WINDOWS, {
      acceptSeconds: 120,
      paymentSeconds: 600,
      settleSeconds: 3600,
    });
  });
  test('a quote for the QR passes; with no merchant named the order pins it later', () =>
    assert.deepEqual(trustQrQuote(q, asked, 7), {
      amountUnits: '86088154',
      integratorFeeUnits: '0',
      buyer: null,
      integrator: null,
    }));
  test('refused: another amount than the QR asks, another rail, currency, network or token', () => {
    assert.equal(trustQrQuote({ ...q, fiatAmount: '12500.01' }, asked, 7), null);
    assert.equal(trustQrQuote({ ...q, rail: 'ar_bank_transfer' }, asked, 7), null);
    assert.equal(trustQrQuote({ ...q, currency: 'BRL' }, asked, 7), null);
    assert.equal(trustQrQuote({ ...q, network: 'mainnet' }, asked, 7), null);
    assert.equal(trustQrQuote({ ...q, token: 'TUSD' }, asked, 7), null);
  });
  test('a static QR: the amount the person typed', () => {
    const stat = { ...ar, amount: null };
    assert.notEqual(trustQrQuote(q, { ...asked, qr: stat, fiatAmount: '12500' }, 7), null);
    assert.equal(trustQrQuote(q, { ...asked, qr: stat, fiatAmount: '9000' }, 7), null);
    assert.equal(trustQrQuote(q, { ...asked, qr: stat, fiatAmount: null }, 7), null);
  });
  test('refused: an integrator fee no rate reproduces, or with no recipient', () =>
    assert.equal(trustQrQuote({ ...q, integratorFee: '0.5', integrator: null }, asked, 7), null));
});

describe("the app's token", () => {
  const tok = (symbol: string, contract: string, issuer: string | null = ISSUER) => ({
    symbol,
    code: symbol,
    issuer,
    contract,
    decimals: 7,
  });
  const net = { tokens: [tok('USDC', 'CU'), tok('TUSD', 'CT')] };
  const bal = (usdc: string, tusd: string, trust = true) => ({
    tokens: [
      { symbol: 'USDC', contract: 'CU', amount: usdc, trustline: trust, authorized: trust },
      { symbol: 'TUSD', contract: 'CT', amount: tusd, trustline: true, authorized: true },
    ],
  });
  test('a configured token wins when the market lists it and the wallet holds some', () => {
    assert.equal(pickToken(net, bal('5', '9'), 'TUSD')?.symbol, 'TUSD');
    assert.equal(pickToken(net, bal('50', '1'), 'TUSD')?.symbol, 'TUSD');
    assert.equal(pickToken(net, bal('5', '0'), 'EURC')?.symbol, 'USDC', 'not listed: ignored');
  });
  test('a balance always shows: held tokens before a configured one the wallet lacks', () => {
    assert.equal(pickToken(net, bal('10000000000', '0'), 'TUSD')?.symbol, 'USDC');
    assert.equal(pickToken(net, bal('0', '0'), 'TUSD')?.symbol, 'TUSD', 'nothing held yet');
    assert.equal(pickToken(net, null, 'TUSD')?.symbol, 'TUSD', 'balances not known yet');
  });
  test('else the token the wallet holds, the largest holding first', () => {
    assert.equal(pickToken(net, bal('0', '50000000000'), '')?.symbol, 'TUSD');
    assert.equal(pickToken(net, bal('10', '5'), '')?.symbol, 'USDC');
    assert.equal(pickToken(net, bal('10', '50'), '')?.symbol, 'TUSD');
    assert.equal(
      pickToken(net, bal('99', '0', false), '')?.symbol,
      'USDC',
      'no trustline: not held',
    );
  });
  test('the token the person picked comes first, when the market lists it', () => {
    assert.equal(pickToken(net, bal('5', '9'), 'TUSD', 'USDC')?.symbol, 'USDC');
    assert.equal(pickToken(net, bal('0', '9'), '', 'USDC')?.symbol, 'USDC', 'even with none held');
    assert.equal(pickToken(net, bal('5', '0'), '', 'EURC')?.symbol, 'USDC', 'not listed: ignored');
  });
  test('a dollar token before the native coin, whatever the unit counts', () => {
    const withXlm = { tokens: [tok('USDC', 'CU'), tok('XLM', 'CX', null)] };
    const held = (usdc: string, xlm: string) => ({
      tokens: [
        { symbol: 'USDC', contract: 'CU', amount: usdc, trustline: true, authorized: true },
        { symbol: 'XLM', contract: 'CX', amount: xlm, trustline: true, authorized: true },
      ],
    });
    assert.equal(pickToken(withXlm, held('50000000', '90000000000'), '')?.symbol, 'USDC');
    assert.equal(pickToken(withXlm, held('0', '90000000000'), '')?.symbol, 'XLM', 'only XLM held');
    assert.equal(pickToken(withXlm, held('50000000', '9'), '', 'XLM')?.symbol, 'XLM', 'picked');
  });
  test('else USDC, else the first listed', () => {
    assert.equal(pickToken(net, null, '')?.symbol, 'USDC');
    assert.equal(pickToken({ tokens: [tok('TUSD', 'CT')] }, null, '')?.symbol, 'TUSD');
    assert.equal(pickToken(null, null, ''), null);
  });
});

describe('which tokens read as dollars', () => {
  test('dollar stablecoins show as US$, the native coin in its own unit', () => {
    for (const s of ['USDC', 'usdc', 'TUSD', 'USDT', 'PYUSD'])
      assert.equal(isDollarToken(s), true, s);
    for (const s of ['XLM', 'EURC', '', null, undefined])
      assert.equal(isDollarToken(s), false, String(s));
  });
});
