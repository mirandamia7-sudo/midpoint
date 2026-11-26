import { emvCrc } from '@midpoint/payment-qr';
import { describe, expect, it } from 'vitest';
import { isReservedHandle } from '@/p2p/app-wallet.service';
import { qrHash, readQrPayment } from '@/p2p/domain/qr-pay';
import { isQrRail, P2P_RAILS, qrRailFor, validateRailDetails } from '@/p2p/domain/rails';

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** An EMV merchant QR with a valid CRC. */
function emv(fields: string[]): string {
  const body = `${tlv('00', '01')}${fields.join('')}6304`;
  return `${body}${emvCrc(body)}`;
}

/** Argentina's interoperable QR (a dynamic one carries its amount). */
const arQr = (amount?: string) =>
  emv([
    tlv('01', amount ? '12' : '11'),
    tlv('43', `${tlv('00', 'com.mercadolibre')}${tlv('01', 'abc123')}`),
    tlv('52', '5812'),
    tlv('53', '032'),
    ...(amount ? [tlv('54', amount)] : []),
    tlv('58', 'AR'),
    tlv('59', 'PANADERIA EL HORNERO'),
    tlv('60', 'BUENOS AIRES'),
    tlv('62', tlv('05', 'TICKET-42')),
  ]);

/** A PIX BR Code. */
const pixQr = (amount?: string) =>
  emv([
    tlv('01', '12'),
    tlv('26', `${tlv('00', 'br.gov.bcb.pix')}${tlv('01', 'pix@loja.example')}`),
    tlv('52', '0000'),
    tlv('53', '986'),
    ...(amount ? [tlv('54', amount)] : []),
    tlv('58', 'BR'),
    tlv('59', 'LOJA'),
    tlv('60', 'SAO PAULO'),
  ]);

/** The opaque wallet account a Yape QR carries in field 39 (synthetic, base64). */
const YAPE_TOKEN = 'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo=';

/** Peru's interoperable QR in a Yape QR's shape: static, the account an opaque token, no amount. */
const peQr = (options: { amount?: string; country?: string; currency?: string } = {}) =>
  emv([
    tlv('01', options.amount ? '12' : '11'),
    tlv('39', YAPE_TOKEN),
    tlv('52', '5611'),
    tlv('53', options.currency ?? '604'),
    ...(options.amount ? [tlv('54', options.amount)] : []),
    tlv('58', options.country ?? 'PE'),
    tlv('59', 'BODEGA LUCHO'),
    tlv('60', 'Lima'),
  ]);

describe('QR payments', () => {
  it('reads Argentina’s interoperable QR on ar_qr, with its own amount', () => {
    const read = readQrPayment(arQr('12500.00'));
    if (!read.ok) throw new Error(read.error);
    expect(read).toMatchObject({ rail: 'ar_qr', currency: 'ARS', fiatAmount: '12500.00' });
    expect(read.summary).toEqual({
      standard: 'ar-interoperable',
      merchantName: 'PANADERIA EL HORNERO',
      merchantCity: 'BUENOS AIRES',
      amount: '12500.00',
      currency: 'ARS',
    });
    expect(read.sealed).toMatchObject({ payload: arQr('12500.00'), reference: 'TICKET-42' });
    expect(read.hash).toBe(qrHash(arQr('12500.00')));
  });

  it('reads PIX on br_pix_qr', () => {
    const read = readQrPayment(pixQr('35.90'));
    expect(read).toMatchObject({
      ok: true,
      rail: 'br_pix_qr',
      currency: 'BRL',
      fiatAmount: '35.90',
    });
  });

  it('reads Peru’s interoperable QR (Yape, Plin, banks) on pe_qr, at the amount the person types', () => {
    // A static QR carries no amount: the person types it, as with the static AR and PIX QRs.
    expect(readQrPayment(peQr())).toEqual({
      ok: false,
      error: 'this QR carries no amount: give fiatAmount',
    });
    const read = readQrPayment(peQr(), '20');
    if (!read.ok) throw new Error(read.error);
    expect(read).toMatchObject({ rail: 'pe_qr', currency: 'PEN', fiatAmount: '20.00' });
    expect(read.summary).toEqual({
      standard: 'pe-interoperable',
      merchantName: 'BODEGA LUCHO',
      merchantCity: 'Lima',
      amount: null,
      currency: 'PEN',
    });
    // The opaque account stays in the sealed payload, byte for byte, for the merchant who pays it.
    expect(read.sealed.payload).toBe(peQr());
    expect(read.sealed.payload).toContain(YAPE_TOKEN);
    // A dynamic Peru QR is paid its own amount.
    expect(readQrPayment(peQr({ amount: '12.50' }))).toMatchObject({
      ok: true,
      rail: 'pe_qr',
      fiatAmount: '12.50',
    });
    expect(readQrPayment(peQr({ amount: '12.50' }), '13')).toMatchObject({ ok: false });
  });

  it('refuses a Peru QR in another currency, and the opaque account outside Peru', () => {
    // PE in US dollars is no interoperable QR the market pays (no rail for it).
    expect(readQrPayment(peQr({ currency: '840' }), '20')).toMatchObject({ ok: false });
    // The same opaque account on an Argentine QR fails closed (payment-qr reads it as malformed).
    expect(readQrPayment(peQr({ country: 'AR', currency: '032' }), '20')).toEqual({
      ok: false,
      error: 'the QR is malformed or ambiguous',
    });
  });

  it('takes the typed amount only for a QR without one, and must agree with a QR that has one', () => {
    expect(readQrPayment(arQr())).toMatchObject({ ok: false });
    expect(readQrPayment(arQr(), '800')).toMatchObject({ ok: true, fiatAmount: '800.00' });
    expect(readQrPayment(arQr('12500.00'), '12500')).toMatchObject({ ok: true });
    expect(readQrPayment(arQr('12500.00'), '100')).toMatchObject({ ok: false });
  });

  it('refuses a bad CRC, a non-EMV text and a QR of another standard or currency', () => {
    const good = arQr('10');
    expect(readQrPayment(`${good.slice(0, -1)}${good.endsWith('0') ? '1' : '0'}`)).toMatchObject({
      ok: false,
    });
    expect(readQrPayment('hello')).toMatchObject({ ok: false });
    const usd = emv([tlv('53', '840'), tlv('58', 'US'), tlv('59', 'SHOP'), tlv('60', 'NYC')]);
    expect(readQrPayment(usd, '10')).toMatchObject({ ok: false });
  });

  it('keeps QR rails out of accounts', () => {
    expect(isQrRail('ar_qr')).toBe(true);
    expect(isQrRail('pe_qr')).toBe(true);
    expect(isQrRail('ar_bank_transfer')).toBe(false);
    expect(isQrRail('pe_bank_transfer')).toBe(false);
    expect(qrRailFor('pix')).toBe('br_pix_qr');
    expect(qrRailFor('ar-interoperable')).toBe('ar_qr');
    expect(qrRailFor('pe-interoperable')).toBe('pe_qr');
    expect(qrRailFor('emv')).toBeNull();
    expect(P2P_RAILS.ar_qr.fields).toEqual([]);
    expect(validateRailDetails('ar_qr', 'ARS', {})).toMatchObject({ ok: false });
    expect(P2P_RAILS.pe_qr).toMatchObject({
      currency: 'PEN',
      qr: 'pe-interoperable',
      name: 'Interoperable QR (Peru: Yape, Plin, banks)',
      fields: [],
    });
    expect(validateRailDetails('pe_qr', 'PEN', {})).toEqual({
      ok: false,
      errors: ['pe_qr takes no account: the destination is the scanned QR'],
    });
    expect(validateRailDetails('pe_qr', 'PEN', { cci: '00219300123456789012' }).ok).toBe(false);
    expect(P2P_RAILS.pe_qr.summary({})).toBe('QR');
  });
});

describe('handles', () => {
  it('reserves the product’s and the platform’s words', () => {
    expect(isReservedHandle('admin', 'midpoint')).toBe(true);
    expect(isReservedHandle('midpoint_team', 'midpoint')).toBe(true);
    expect(isReservedHandle('newbrand', 'New Brand')).toBe(true);
    expect(isReservedHandle('maria_flores', 'midpoint')).toBe(false);
  });
});
