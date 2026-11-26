import { describe, expect, it } from 'vitest';
import {
  RECEIPT_MESSAGE,
  maskedAccount,
  operationNumber,
  receiptLines,
  receiptMessage,
  receiptPdf,
  receiptTime,
} from '@/bot/receipt';
import type { MerchantOrder } from '@/types';
import { transferMatch } from '@test/fixtures';

const PAID_AT = new Date('2026-11-20T13:15:00Z');

/** A sale the merchant pays: the person's Bolivian account is the beneficiary. */
const sale: MerchantOrder = {
  ...transferMatch('31', 3).order,
  id: '3f1c2b7e-8d4a-4c1e-9b2f-6a5d4c3b2a10',
  kind: 'SELL',
  merchantSide: 'buyer',
  currency: 'BOB',
  fiatAmount: '118.26',
  rail: 'bo_bank_transfer',
  beneficiary: {
    holderName: 'Ana Quispe Mamani',
    document: '4567891',
    rail: 'bo_bank_transfer',
    details: { bank: 'Banco Unión', accountNumber: '1000012345678' },
  },
};

describe('receiptPdf', () => {
  it('writes a PDF whose cross-reference table points at every object', () => {
    const pdf = receiptPdf(['Comprobante de transferencia', 'Monto: 118.26 BOB']);
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.endsWith('%%EOF\n')).toBe(true);
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(6);
    offsets.forEach((offset, i) => {
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    const stream = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(text);
    expect(Number(stream?.[1])).toBe(Buffer.byteLength(stream?.[2] ?? '', 'latin1'));
    expect(text).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
  });

  it('prints Spanish accents and the bullet in WinAnsi, escapes parentheses, and drops the rest', () => {
    const pdf = receiptPdf(['Operación', 'Cuenta: ••••5678 (caja) \\ 漢']);
    // ó is 0xF3, the bullet 0x95 (one byte each); a character outside WinAnsi becomes "?".
    expect(pdf.includes(Buffer.from([0x4f, 0x70, 0x65, 0x72, 0x61, 0x63, 0x69, 0xf3, 0x6e]))).toBe(
      true,
    );
    expect(pdf.includes(Buffer.from([0x95, 0x95, 0x95, 0x95, 0x35]))).toBe(true);
    expect(pdf.toString('latin1')).toContain('\\(caja\\) \\\\ ?');
  });
});

describe('the receipt', () => {
  it('names the merchant, the time, the amount, the rail, the beneficiary and the order', () => {
    expect(receiptLines(sale, 'Andes Cambio', PAID_AT)).toEqual([
      'Comprobante de transferencia',
      'Emisor: Andes Cambio',
      'Fecha y hora: 20/11/2026 09:15 (GMT-4)',
      'Monto: 118.26 BOB',
      'Medio: Transferencia bancaria',
      'Beneficiario: Ana Quispe Mamani',
      'Cuenta: ••••5678',
      'Orden: 3f1c2b7e',
      `Operación N.º ${operationNumber(sale.id)}`,
    ]);
  });

  it('names a third party paid with no ID (the rails that do not need one)', () => {
    const third: MerchantOrder = {
      ...sale,
      currency: 'PEN',
      rail: 'pe_bank_transfer',
      beneficiary: {
        holderName: 'Rosa Quispe',
        document: null,
        rail: 'pe_bank_transfer',
        details: { cci: '00219300123456789012' },
      },
    };
    const lines = receiptLines(third, 'Río Express', PAID_AT);
    expect(lines).toContain('Beneficiario: Rosa Quispe');
    expect(lines).toContain('Cuenta: ••••9012');
    expect(lines.join(' | ')).not.toMatch(/null|undefined/);
  });

  it('names the shop and its QR on a QR payment', () => {
    const qr: MerchantOrder = {
      ...sale,
      kind: 'QR_PAY',
      currency: 'ARS',
      rail: 'ar_qr',
      beneficiary: null,
      qr: {
        payload: '000201...',
        standard: 'ar-interoperable',
        merchantName: 'PANADERIA EL HORNERO',
        merchantCity: 'BUENOS AIRES',
        amount: '5950.00',
        currency: 'ARS',
        reference: 'T123',
      },
    };
    const lines = receiptLines(qr, 'Illimani Pagos', PAID_AT);
    expect(lines).toContain('Beneficiario: PANADERIA EL HORNERO');
    expect(lines).toContain('Cuenta: QR ref. T123');
    expect(lines).toContain('Medio: Pago con QR interoperable');
    expect(lines).toContain('Fecha y hora: 20/11/2026 10:15 (GMT-3)');
    // Peru's QR (Yape, Plin, banks), in Lima's time.
    const yape = receiptLines(
      {
        ...qr,
        currency: 'PEN',
        rail: 'pe_qr',
        qr: {
          ...(qr.qr as NonNullable<MerchantOrder['qr']>),
          standard: 'pe-interoperable',
          reference: null,
        },
      },
      'Río Express',
      PAID_AT,
    );
    expect(yape).toContain('Medio: Pago con QR interoperable (Yape, Plin)');
    expect(yape).toContain('Cuenta: QR del comercio');
    expect(yape).toContain('Fecha y hora: 20/11/2026 08:15 (GMT-5)');
  });

  it('masks the account, keeps a stable made-up operation number, and reads the local time', () => {
    expect(maskedAccount({ cbu: '2850590940090418135201', cuit: '20123456786' })).toBe('••••5201');
    expect(maskedAccount({ alias: 'mi.alias' })).toBe('••••lias');
    expect(maskedAccount({ key: '123' })).toBe('123');
    expect(maskedAccount({})).toBe('••••');
    expect(operationNumber(sale.id)).toMatch(/^\d{10}$/);
    expect(operationNumber(sale.id)).toBe(operationNumber(sale.id));
    expect(operationNumber(sale.id)).not.toBe(operationNumber('another-order'));
    // Another currency reads UTC (ICU spells it GMT or GMT+0).
    expect(receiptTime(PAID_AT, 'XYZ')).toMatch(/^20\/11\/2026 13:15 \(GMT(\+0)?\)$/);
  });

  it('travels as a chat message: the text and a PDF in base64', () => {
    const message = receiptMessage(sale, 'Andes Cambio', PAID_AT);
    expect(message.text).toBe(RECEIPT_MESSAGE);
    expect(message.attachment).toMatchObject({
      name: 'comprobante-3f1c2b7e.pdf',
      contentType: 'application/pdf',
    });
    const bytes = Buffer.from(message.attachment?.data ?? '', 'base64');
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.toString('latin1')).toContain('(Comprobante de transferencia) Tj');
    expect(bytes.length).toBeLessThan(4096);
  });
});
