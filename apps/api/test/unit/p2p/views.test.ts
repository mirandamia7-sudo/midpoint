import { describe, expect, it } from 'vitest';
import {
  settleDeadlineOf,
  toMerchantOrderView,
  toOrderView,
  toOrderWebhookData,
  type P2pOrderRow,
} from '@/p2p/views';

const ROW: P2pOrderRow = {
  id: '3f1c2b7e-8d4a-4c1e-9b2f-6a5d4c3b2a10',
  organizationId: 'org_client',
  tier: 'test',
  kind: 'BUY',
  endUserAddress: null,
  network: 'base',
  contract: 'CAKGHC55HFGIGFDRKKLH7MYLVXE5ELAO57VE2VUCDXBWDVFNDIXXZTJ7',
  token: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  tokenSymbol: 'USDC',
  tokenDecimals: 6,
  merchantAccountId: 'acc_merchant',
  merchantOrganizationId: 'org_merchant',
  merchantAddress: 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI',
  merchantDisplayName: 'Oriente Cambio',
  merchantPaymentMethodId: 'pm_1',
  currency: 'ARS',
  rail: 'ar_bank_transfer',
  price: '1250.5',
  fiatAmount: '125050.00',
  tokenAmount: '100000000',
  netAmount: '99500000',
  protocolFeeBps: 50,
  integratorFeeBps: 25,
  integratorAddress: 'GAXTHY6ASJEWI3OJGM7UZ2KSMBQD7VHCCH27PAL6ALSSSW7D33B5WMMI',
  bond: '0',
  acceptWindow: 0,
  paymentWindow: 1800,
  settleWindow: 0,
  openerAddress: 'GBUHPZXBNYCJAVEVZRDNUTEPKIVG3NF36KQXVOZNIGI5NMJTUOROAP4R',
  sellerAddress: 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI',
  buyerAddress: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
  onchainId: '7',
  status: 'awaiting_payment',
  acceptDeadline: null,
  paymentDeadline: new Date('2026-11-19T12:31:00Z'),
  paidAt: null,
  endedAt: null,
  openTxHash: 'ab'.repeat(32),
  acceptTxHash: null,
  paidTxHash: null,
  releaseTxHash: null,
  cancelTxHash: null,
  disputeTxHash: null,
  resolveTxHash: null,
  settlement: null,
  paidReference: 'TRX-1',
  failureReason: null,
  chargeId: '9b7e2c41-3f5a-4d8e-a1b2-c3d4e5f60718',
  payoutBatchId: 'batch_1',
  externalReference: 'client-secret-ref-881',
  chatCount: 2,
  chatLastAt: new Date('2026-11-19T12:05:00Z'),
  chatLastFrom: 'merchant',
  createdAt: new Date('2026-11-19T12:01:00Z'),
  updatedAt: new Date('2026-11-19T12:01:00Z'),
};

/** What the client keeps for itself: never in anything the merchant reads. */
const CLIENT_ONLY = [
  'externalReference',
  'chargeId',
  'payoutBatchId',
  'integratorFeeBps',
  'integratorAddress',
  'protocolFeeBps',
  'organizationId',
  'merchantOrganizationId',
  'merchantPaymentMethodId',
  'openerAddress',
  'failureReason',
  'paymentDetails',
  'merchant',
];

const PERSONAL = ['paymentDetails', 'payer', 'beneficiary'];

describe('P2P views', () => {
  it('gives the merchant webhook exactly the merchant projection’s public keys', () => {
    const body = toOrderWebhookData(ROW, 'merchant');
    expect(Object.keys(body).sort()).toEqual(
      [
        'id',
        'kind',
        'status',
        'tier',
        'network',
        'contract',
        'merchantAccountId',
        'merchantSide',
        'token',
        'tokenSymbol',
        'tokenDecimals',
        'currency',
        'rail',
        'price',
        'fiatAmount',
        'tokenAmount',
        'netAmount',
        'bond',
        'sellerAddress',
        'buyerAddress',
        'onchainId',
        'acceptDeadline',
        'paymentDeadline',
        'paidAt',
        'settleDeadline',
        'endedAt',
        'txHashes',
        'settlement',
        'paidReference',
        'createdAt',
        'updatedAt',
        'role',
      ].sort(),
    );
    expect(body.role).toBe('merchant');
    for (const key of [...CLIENT_ONLY, ...PERSONAL]) {
      expect(body).not.toHaveProperty(key);
    }
    expect(JSON.stringify(body)).not.toContain('client-secret-ref-881');
  });

  it('gives the client webhook its own order, without anyone’s personal details', () => {
    const body = toOrderWebhookData(ROW, 'client');
    expect(body).toMatchObject({
      role: 'client',
      externalReference: 'client-secret-ref-881',
      chargeId: ROW.chargeId,
      integratorFeeBps: 25,
      merchant: { displayName: 'Oriente Cambio' },
    });
    for (const key of [
      ...PERSONAL,
      'organizationId',
      'merchantOrganizationId',
      'merchantAccountId',
      'merchantPaymentMethodId',
      'integratorAddress',
      'openerAddress',
    ]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it('summarises the chat on both sides’ views, never in a webhook body', () => {
    const chat = { count: 2, lastAt: new Date('2026-11-19T12:05:00Z'), lastFrom: 'merchant' };
    expect(toOrderView(ROW, null).chat).toEqual(chat);
    expect(toMerchantOrderView(ROW, { payer: null, beneficiary: null }).chat).toEqual(chat);
    expect(
      toOrderView({ ...ROW, chatCount: 0, chatLastAt: null, chatLastFrom: null }, null).chat,
    ).toEqual({ count: 0, lastAt: null, lastFrom: null });
    expect(toOrderWebhookData(ROW, 'client')).not.toHaveProperty('chat');
    expect(toOrderWebhookData(ROW, 'merchant')).not.toHaveProperty('chat');
  });

  it('never shows the merchant the client’s own fields on its order routes', () => {
    const view = toMerchantOrderView(ROW, {
      payer: { name: 'Juan Gómez', document: '20123456786' },
      beneficiary: null,
    });
    for (const key of CLIENT_ONLY) expect(view).not.toHaveProperty(key);
    expect(view.payer).toEqual({ name: 'Juan Gómez', document: '20123456786' });
  });

  it('shows the counterparty’s details to the merchant only while the order is live', () => {
    const ended = toMerchantOrderView(
      { ...ROW, status: 'completed' },
      {
        payer: { name: 'Juan Gómez', document: '20123456786' },
        beneficiary: {
          holderName: 'Ana',
          document: '27234567891',
          rail: 'ar_bank_transfer',
          details: {},
        },
      },
    );
    expect(ended.payer).toBeNull();
    expect(ended.beneficiary).toBeNull();
  });

  it('closes the settle window settleWindow seconds after the payment, and only with one', () => {
    const paidAt = new Date('2026-11-19T12:00:00Z');
    expect(settleDeadlineOf({ paidAt, settleWindow: 21_600 })).toEqual(
      new Date('2026-11-19T18:00:00Z'),
    );
    expect(settleDeadlineOf({ paidAt, settleWindow: 0 })).toBeNull();
    expect(settleDeadlineOf({ paidAt: null, settleWindow: 21_600 })).toBeNull();
    const view = toMerchantOrderView(
      { ...ROW, kind: 'SELL', status: 'paid', paidAt, settleWindow: 21_600 },
      { payer: null, beneficiary: null },
    );
    expect(view.settleDeadline).toEqual(new Date('2026-11-19T18:00:00Z'));
    expect(toOrderWebhookData({ ...ROW, paidAt, settleWindow: 3600 }, 'client')).toHaveProperty(
      'settleDeadline',
      new Date('2026-11-19T13:00:00Z'),
    );
  });

  it('never shows the client the merchant’s internal ids', () => {
    const view = toOrderView(ROW, null);
    for (const key of [
      'organizationId',
      'merchantOrganizationId',
      'merchantAccountId',
      'merchantPaymentMethodId',
      'integratorAddress',
      'openerAddress',
    ]) {
      expect(view).not.toHaveProperty(key);
    }
  });
});
