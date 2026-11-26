/* Merchant QR payloads for mock mode and tests, built the way EMVCo specifies (TLV fields and a
   CRC16 in field 63), so @midpoint/payment-qr reads them like a real scan. */
import { emvCrc } from '@midpoint/payment-qr';

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;
const withCrc = (body: string) => `${body}6304${emvCrc(`${body}6304`)}`;

/** An Argentine interoperable QR (Transferencias 3.0). `amount` null: a static QR, the payer
    types the amount. */
export function arQr(input: {
  merchant: string;
  city: string;
  amount: string | null;
  reference?: string;
}): string {
  return withCrc(
    tlv('00', '01') +
      tlv('01', input.amount ? '12' : '11') +
      tlv('43', tlv('00', 'com.mercadolibre') + tlv('01', '0000003100012345678901')) +
      tlv('52', '5812') +
      tlv('53', '032') +
      (input.amount ? tlv('54', input.amount) : '') +
      tlv('58', 'AR') +
      tlv('59', input.merchant) +
      tlv('60', input.city) +
      tlv('62', tlv('05', input.reference ?? 'CAJA-1')),
  );
}

/** A PIX BR Code with a key (static) and, optionally, an amount. */
export function pixQr(input: { merchant: string; city: string; amount: string | null }): string {
  return withCrc(
    tlv('00', '01') +
      tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', 'loja@exemplo.com.br')) +
      tlv('52', '0000') +
      tlv('53', '986') +
      (input.amount ? tlv('54', input.amount) : '') +
      tlv('58', 'BR') +
      tlv('59', input.merchant) +
      tlv('60', input.city) +
      tlv('62', tlv('05', '***')),
  );
}

/** Peru's interoperable QR the way Yape makes one: the account is an opaque token in field 39
    (not a TLV template); static unless it carries an amount. */
export function peQr(input: { merchant: string; city: string; amount: string | null }): string {
  return withCrc(
    tlv('00', '01') +
      tlv('01', input.amount ? '12' : '11') +
      tlv('39', 'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo=') +
      tlv('52', '5611') +
      tlv('53', '604') +
      (input.amount ? tlv('54', input.amount) : '') +
      tlv('58', 'PE') +
      tlv('59', input.merchant) +
      tlv('60', input.city),
  );
}

/** The QRs the demo uses, the shops a person from Bolivia pays abroad: a café's dynamic QR in
    Cusco, a corner shop's static PIX in Corumbá, a bakery's PIX with an amount, and a Yape QR in
    Lima. */
export const DEMO_QRS = {
  cafe: peQr({ merchant: 'Cafe El Balcon', city: 'Cusco', amount: '45.00' }),
  kiosk: pixQr({ merchant: 'Mercadinho Fronteira', city: 'CORUMBA', amount: null }),
  pix: pixQr({ merchant: 'Padaria Boa Vista', city: 'SAO PAULO', amount: '32.50' }),
  yape: peQr({ merchant: 'BODEGA LUCHO', city: 'Lima', amount: null }),
};
