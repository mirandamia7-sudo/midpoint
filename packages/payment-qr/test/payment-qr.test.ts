import { describe, expect, it } from 'vitest';
import {
  buildPaymentLink,
  buildSep7Pay,
  emvCrc,
  isStellarAddress,
  normalizeHandle,
  normalizeRecipient,
  parseChargeLink,
  parseEmv,
  parsePaymentLink,
  parseScan,
  parseSep7,
  strKeyKind,
} from '@/index';

// SEP-23 test vectors.
const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const MUXED = 'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK';
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const SECRET = 'SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR';
// Circle's USDC issuer on the public network.
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

// The static BR Code example of the PIX manual (Banco Central do Brasil).
const PIX =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;
const withCrc = (body: string) => `${body}6304${emvCrc(`${body}6304`)}`;

/** A dynamic Argentine interoperable QR for 1500.50 ARS. */
const AR_QR = withCrc(
  tlv('00', '01') +
    tlv('01', '12') +
    tlv('43', tlv('00', 'com.mercadolibre') + tlv('01', '0000003100012345678901')) +
    tlv('52', '5812') +
    tlv('53', '032') +
    tlv('54', '1500.50') +
    tlv('58', 'AR') +
    tlv('59', 'Cafe El Molino') +
    tlv('60', 'Buenos Aires') +
    tlv('62', tlv('05', 'MESA-4')),
);

const ORIGINS = ['https://app.example'];

describe('StrKey', () => {
  it('recognises accounts, muxed accounts, contracts and secrets', () => {
    expect(strKeyKind(ACCOUNT)).toBe('account');
    expect(strKeyKind(MUXED)).toBe('muxed');
    expect(strKeyKind(CONTRACT)).toBe('contract');
    expect(strKeyKind(SECRET)).toBe('secret');
    expect(strKeyKind(USDC_ISSUER)).toBe('account');
  });

  it('refuses a bad checksum, length, alphabet or case', () => {
    expect(strKeyKind(`${ACCOUNT.slice(0, -1)}A`)).toBeNull();
    expect(strKeyKind(ACCOUNT.slice(0, -1))).toBeNull();
    expect(strKeyKind(ACCOUNT.toLowerCase())).toBeNull();
    expect(strKeyKind(`${ACCOUNT.slice(0, 10)}1${ACCOUNT.slice(11)}`)).toBeNull();
    expect(strKeyKind('')).toBeNull();
  });

  it('never treats a secret seed as an address', () => {
    expect(isStellarAddress(SECRET)).toBe(false);
    expect(isStellarAddress(CONTRACT, ['account'])).toBe(false);
    expect(isStellarAddress(ACCOUNT)).toBe(true);
  });
});

describe('EMV merchant QR', () => {
  it('checks the PIX manual example and reads its key', () => {
    expect(emvCrc(PIX.slice(0, -4))).toBe('1D3D');
    const r = parseEmv(PIX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.qr).toMatchObject({
      standard: 'pix',
      dynamic: false,
      merchantName: 'Fulano de Tal',
      merchantCity: 'BRASILIA',
      countryCode: 'BR',
      currency: 'BRL',
      amount: null,
      pixKey: '123e4567-e12b-12d1-a456-426655440000',
      reference: '***',
    });
  });

  it('reads an Argentine interoperable QR with its amount', () => {
    const r = parseEmv(AR_QR);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.qr).toMatchObject({
      standard: 'ar-interoperable',
      dynamic: true,
      currency: 'ARS',
      countryCode: 'AR',
      amount: '1500.50',
      merchantName: 'Cafe El Molino',
      merchantCity: 'Buenos Aires',
      reference: 'MESA-4',
      accounts: ['com.mercadolibre'],
    });
    expect(r.qr.payload).toBe(AR_QR);
  });

  it("reads Peru's interoperable QR, whose wallet account is one opaque token (Yape)", () => {
    // The shape a Yape QR has: field 39 is a base64 token, not a TLV template.
    const token = 'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo=';
    const body =
      tlv('00', '01') +
      tlv('01', '11') +
      tlv('39', token) +
      tlv('52', '5611') +
      tlv('53', '604') +
      tlv('58', 'PE') +
      tlv('59', 'BODEGA LUCHO') +
      tlv('60', 'Lima');
    const r = parseEmv(withCrc(body));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.qr).toMatchObject({
      standard: 'pe-interoperable',
      dynamic: false,
      currency: 'PEN',
      countryCode: 'PE',
      amount: null,
      merchantName: 'BODEGA LUCHO',
      merchantCity: 'Lima',
      accounts: [],
    });
    // With an amount (a dynamic QR) the amount is read as usual.
    const priced = parseEmv(
      withCrc(body.replace(tlv('01', '11'), tlv('01', '12')) + tlv('54', '12.50')),
    );
    expect(priced.ok && priced.qr.amount).toBe('12.50');
    // Outside Peru the same opaque account still fails closed, and so does a token that is not one.
    expect(parseEmv(withCrc(body.replace(tlv('58', 'PE'), tlv('58', 'AR'))))).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(parseEmv(withCrc(body.replace(tlv('39', token), tlv('39', 'not a token!'))))).toEqual({
      ok: false,
      error: 'malformed',
    });
  });

  it('refuses repeated fields, a second PIX account and an amount in an unknown currency', () => {
    const base = tlv('00', '01') + tlv('01', '12');
    const tail = tlv('58', 'AR') + tlv('59', 'Cafe') + tlv('60', 'Buenos Aires');
    // Two amounts: a banking app might pay the other one.
    expect(
      parseEmv(withCrc(base + tlv('53', '032') + tlv('54', '10.00') + tlv('54', '9999.00') + tail)),
    ).toEqual({
      ok: false,
      error: 'malformed',
    });
    // A repeated sub-field inside a template.
    const pixTwice = tlv(
      '26',
      tlv('00', 'br.gov.bcb.pix') + tlv('01', 'a@b.com') + tlv('01', 'c@d.com'),
    );
    expect(parseEmv(withCrc(base + pixTwice + tlv('53', '986') + tlv('58', 'BR')))).toEqual({
      ok: false,
      error: 'malformed',
    });
    // Two PIX merchant-account templates.
    const pixA = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', 'a@b.com'));
    const pixB = tlv('27', tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', 'c@d.com'));
    expect(parseEmv(withCrc(base + pixA + pixB + tlv('53', '986') + tlv('58', 'BR')))).toEqual({
      ok: false,
      error: 'malformed',
    });
    // An amount whose currency is missing or unknown.
    expect(parseEmv(withCrc(base + tlv('54', '10.00') + tail))).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(parseEmv(withCrc(base + tlv('53', '978') + tlv('54', '10.00') + tail))).toEqual({
      ok: false,
      error: 'malformed',
    });
  });

  it('fails closed on prototype-key currencies and unparsable account templates', () => {
    const base = tlv('00', '01') + tlv('01', '12');
    const tail = tlv('58', 'AR') + tlv('59', 'Cafe') + tlv('60', 'Buenos Aires');
    for (const code of ['constructor', 'toString', '__proto__', '32']) {
      expect(parseEmv(withCrc(base + tlv('53', code) + tlv('54', '10.00') + tail))).toEqual({
        ok: false,
        error: 'malformed',
      });
    }
    // A merchant-account template (26-51) or additional data (62) that is not TLV.
    expect(
      parseEmv(withCrc(base + tlv('26', 'br.gov.bcb.pix') + tlv('53', '986') + tlv('58', 'BR'))),
    ).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(parseEmv(withCrc(base + tlv('53', '032') + tail + tlv('62', 'MESA-4')))).toEqual({
      ok: false,
      error: 'malformed',
    });
  });

  it('refuses a changed payload, a broken TLV and non-EMV text', () => {
    expect(parseEmv(AR_QR.replace('1500.50', '9500.50'))).toEqual({ ok: false, error: 'bad-crc' });
    expect(parseEmv(`${AR_QR.slice(0, 20)}99`)).toEqual({ ok: false, error: 'malformed' });
    expect(parseEmv('hello')).toEqual({ ok: false, error: 'not-emv' });
    expect(parseEmv(withCrc(tlv('00', '01') + tlv('54', '12,50') + tlv('58', 'AR')))).toEqual({
      ok: false,
      error: 'malformed',
    });
  });
});

describe('SEP-7', () => {
  it('round-trips a payment request', () => {
    const uri = buildSep7Pay({
      destination: ACCOUNT,
      amount: '12.5',
      assetCode: 'USDC',
      assetIssuer: USDC_ISSUER,
      memo: 'almuerzo del viernes',
      message: 'Gracias!',
    });
    expect(uri.startsWith('web+stellar:pay?')).toBe(true);
    expect(uri).not.toContain('+del');
    const r = parseSep7(uri);
    expect(r).toEqual({
      ok: true,
      pay: {
        destination: ACCOUNT,
        amount: '12.5',
        assetCode: 'USDC',
        assetIssuer: USDC_ISSUER,
        memo: 'almuerzo del viernes',
        memoType: 'MEMO_TEXT',
        message: 'Gracias!',
        networkPassphrase: null,
        originDomain: null,
        signed: false,
      },
    });
  });

  it('refuses tx requests, bad amounts, an issuer alone and long text memos', () => {
    expect(parseSep7('web+stellar:tx?xdr=AAAA')).toEqual({
      ok: false,
      error: 'unsupported-operation',
    });
    expect(parseSep7(`web+stellar:pay?destination=${ACCOUNT}&amount=1.12345678`).ok).toBe(false);
    expect(parseSep7(`web+stellar:pay?destination=${ACCOUNT}&amount=0`).ok).toBe(false);
    expect(parseSep7(`web+stellar:pay?destination=${ACCOUNT}&asset_issuer=${USDC_ISSUER}`).ok).toBe(
      false,
    );
    expect(parseSep7(`web+stellar:pay?destination=${ACCOUNT}&memo=${'x'.repeat(29)}`).ok).toBe(
      false,
    );
    expect(parseSep7(`web+stellar:pay?destination=${SECRET}`).ok).toBe(false);
    expect(() => buildSep7Pay({ destination: SECRET })).toThrow();
  });

  it('reads XLM as the native coin', () => {
    const r = parseSep7(`web+stellar:pay?destination=${ACCOUNT}&amount=3&asset_code=XLM`);
    expect(r.ok && r.pay.assetCode).toBeNull();
  });
});

describe('handles and app links', () => {
  it('normalises handles and recipients', () => {
    expect(normalizeHandle(' @Juan_Perez ')).toBe('juan_perez');
    expect(normalizeHandle('ab')).toBeNull();
    expect(normalizeHandle('juan.perez')).toBeNull();
    expect(normalizeRecipient('@Ana')).toBe('@ana');
    expect(normalizeRecipient(ACCOUNT)).toBe(ACCOUNT);
    expect(normalizeRecipient('ana')).toBeNull();
  });

  it('round-trips a payment link on a trusted origin only', () => {
    const link = buildPaymentLink('https://app.example/', {
      to: '@Ana',
      amount: '10',
      asset: 'usdc',
      note: 'pizza',
    });
    expect(link).toBe('https://app.example/app/send?to=%40ana&amount=10&asset=USDC&note=pizza');
    expect(parsePaymentLink(link, ORIGINS)).toEqual({
      to: '@ana',
      amount: '10',
      asset: 'USDC',
      note: 'pizza',
    });
    expect(parsePaymentLink(link, ['https://evil.example'])).toBeNull();
    expect(parsePaymentLink('https://app.example/app/send?to=%40ana&amount=-1', ORIGINS)).toEqual({
      to: '@ana',
      amount: null,
      asset: null,
      note: null,
    });
  });

  it('reads charge links', () => {
    expect(parseChargeLink('https://app.example/pay/ch_123456', ORIGINS)).toBe('ch_123456');
    expect(parseChargeLink('https://app.example/c/ch_123456/', ORIGINS)).toBe('ch_123456');
    expect(parseChargeLink('https://other.example/pay/ch_123456', ORIGINS)).toBeNull();
  });
});

describe('parseScan', () => {
  it('routes every kind of scanned text', () => {
    expect(parseScan(ACCOUNT, { origins: ORIGINS })).toMatchObject({
      kind: 'pay-to',
      via: 'address',
      to: ACCOUNT,
    });
    expect(parseScan('@ana', { origins: ORIGINS })).toMatchObject({
      kind: 'pay-to',
      via: 'handle',
      to: '@ana',
    });
    expect(
      parseScan('https://app.example/app/send?to=%40ana&amount=5', { origins: ORIGINS }),
    ).toMatchObject({
      kind: 'pay-to',
      via: 'app-link',
      to: '@ana',
      amount: '5',
    });
    expect(
      parseScan(
        `web+stellar:pay?destination=${CONTRACT}&amount=2&asset_code=USDC&asset_issuer=${USDC_ISSUER}`,
        {
          origins: ORIGINS,
        },
      ),
    ).toMatchObject({
      kind: 'pay-to',
      via: 'sep7',
      to: CONTRACT,
      asset: 'USDC',
      assetIssuer: USDC_ISSUER,
    });
    expect(parseScan('https://app.example/pay/ch_123456', { origins: ORIGINS })).toEqual({
      kind: 'charge',
      chargeId: 'ch_123456',
    });
    expect(parseScan(AR_QR, { origins: ORIGINS })).toMatchObject({
      kind: 'merchant-qr',
      qr: { standard: 'ar-interoperable', amount: '1500.50' },
    });
    expect(parseScan(PIX, { origins: ORIGINS })).toMatchObject({
      kind: 'merchant-qr',
      qr: { standard: 'pix' },
    });
  });

  it('warns on a secret key and refuses what it cannot pay', () => {
    expect(parseScan(SECRET, { origins: ORIGINS })).toEqual({ kind: 'secret-key' });
    expect(parseScan('web+stellar:tx?xdr=AAAA', { origins: ORIGINS })).toEqual({
      kind: 'unsupported',
      reason: 'sep7-tx',
    });
    expect(parseScan('https://evil.example/pay/ch_123456', { origins: ORIGINS })).toEqual({
      kind: 'unsupported',
      reason: 'foreign-link',
    });
    const badCrc = `${AR_QR.slice(0, -1)}${AR_QR.endsWith('0') ? '1' : '0'}`;
    expect(parseScan(badCrc, { origins: ORIGINS })).toEqual({
      kind: 'unsupported',
      reason: 'emv-invalid',
    });
    expect(parseScan('hola', { origins: ORIGINS })).toEqual({
      kind: 'unsupported',
      reason: 'unknown',
    });
  });
});
