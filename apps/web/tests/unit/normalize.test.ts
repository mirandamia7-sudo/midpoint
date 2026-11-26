/* normalize.test.ts: the API's answers, in its wire shapes, become what the screens read
   (src/lib/p2p/normalize.ts), and the screens' requests become the bodies the API takes. The
   market is on Stellar: networks with a passphrase and a Soroban contract, tokens as assets with
   their SAC contract and 7 decimals, unsigned transactions as XDR. */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  normalizeMarket,
  normalizeAccount,
  normalizeOffer,
  normalizeQuote,
  normalizeOrder,
  normalizeTransferMatches,
  normalizeCharge,
  normalizePayoutBatch,
  txArgs,
  decimalsOf,
  matchConfidence,
} from '@/lib/p2p/normalize';

const ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const USDC_SAC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const MARKET_C = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const MERCHANT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const MARKET = {
  available: true,
  tier: 'public',
  networks: [
    {
      id: 'mainnet',
      name: 'Stellar',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
      contract: MARKET_C,
      tokens: [{ symbol: 'USDC', code: 'USDC', issuer: ISSUER, contract: USDC_SAC, decimals: 7 }],
      protocolFeeBps: 30,
      paused: false,
      explorerUrl: 'https://stellar.expert/explorer/public',
      rpcUrl: 'https://rpc.example',
      horizonUrl: null,
    },
    {
      id: 'testnet',
      name: 'Stellar Testnet',
      networkPassphrase: 'Test SDF Network ; September 2015',
      contract: MARKET_C,
      tokens: [],
      protocolFeeBps: 25,
      paused: true,
    },
    {
      id: 'evm',
      name: 'An EVM network',
      chainId: 8453,
      contract: '0x1111111111111111111111111111111111111111',
      tokens: [],
      protocolFeeBps: 30,
      paused: false,
    },
  ],
  currencies: [
    {
      code: 'ARS',
      decimals: 2,
      rails: [
        {
          id: 'ar_bank_transfer',
          name: 'Bank transfer',
          fields: [
            { name: 'cbu', description: '', required: false },
            { name: 'cuit', description: '', required: true },
          ],
        },
      ],
    },
  ],
  windows: {
    buyPaymentWindow: 1800,
    sellAcceptWindow: 300,
    sellPaymentWindow: 1800,
    sellSettleWindow: 21600,
  },
  bondBps: 1000,
  matcher: null,
  maxIntegratorFeeBps: 500,
  sponsor: { enabled: true },
};

test('the market: flat rails, windows and fee, paused (and non-Stellar) networks left out', () => {
  const m = normalizeMarket(MARKET)!;
  assert.equal(m.tier, 'mainnet');
  assert.deepEqual(
    m.networks.map((n) => n.id),
    ['mainnet'],
    'a network without a passphrase is not a Stellar network',
  );
  assert.deepEqual(m.currencies, [{ code: 'ARS', rails: ['ar_bank_transfer'] }]);
  assert.deepEqual(m.rails, [
    {
      id: 'ar_bank_transfer',
      currency: 'ARS',
      fields: [
        { key: 'cbu', required: false },
        { key: 'cuit', required: true },
      ],
    },
  ]);
  assert.deepEqual(m.windows, {
    paymentSeconds: 1800,
    acceptSeconds: 300,
    settleSeconds: 21600,
    sellPaymentSeconds: 1800,
  });
  assert.equal(m.sellBondBps, 1000);
  assert.equal(m.protocolFeeBps, 30);
  assert.equal(m.matcher, '');
  assert.deepEqual(m.networks[0], {
    id: 'mainnet',
    name: 'Stellar',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://rpc.example',
    horizonUrl: null,
    explorerUrl: 'https://stellar.expert/explorer/public',
    contract: MARKET_C,
    protocolFeeBps: 30,
    tokens: [{ symbol: 'USDC', code: 'USDC', issuer: ISSUER, contract: USDC_SAC, decimals: 7 }],
  });
  assert.deepEqual(m.sponsor, { enabled: true });
  assert.deepEqual(normalizeMarket({ ...MARKET, sponsor: undefined })!.sponsor, {
    enabled: false,
  });
  assert.equal(normalizeMarket({ nope: 1 }), null);
  assert.deepEqual(normalizeMarket(m), m, "the screens' own shape stays as it is");
  assert.equal(decimalsOf(m, 'mainnet', 'USDC'), 7);
  assert.equal(decimalsOf(m, 'mainnet', USDC_SAC), 7, 'by the token contract too');
  assert.equal(decimalsOf(m, 'mainnet', 'EURC'), 7, "an unknown token: Stellar's 7");
});

test('an account: the merchant profile and the chain state', () => {
  const a = normalizeAccount({
    id: 'acc',
    address: MERCHANT,
    label: 'Treasury',
    displayName: 'Lumio',
    merchantStatus: 'PAUSED',
    stats: {
      completedOrders: 12,
      cancelledOrders: 1,
      completionRate: 0.9,
      disputesLost: 0,
      medianReleaseSeconds: 240,
    },
    lastActiveAt: '2026-11-19T10:00:00Z',
    tier: 'public',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
    networks: [
      {
        network: 'mainnet',
        balances: [
          { symbol: 'USDC', token: USDC_SAC, amount: '15000000', locked: '2500000', decimals: 7 },
        ],
        matcher: { maxPerOrder: '0', autoSettle: false },
        operators: { GBOT: 6, GOLD: 0 },
      },
      {
        network: 'testnet',
        balances: [],
        matcher: { maxPerOrder: '1000000000', autoSettle: true },
        operators: {},
      },
    ],
  });
  assert.deepEqual(a.merchant, {
    displayName: 'Lumio',
    status: 'PAUSED',
    stats: {
      completed: 12,
      cancelled: 1,
      disputesLost: 0,
      medianReleaseSeconds: 240,
      lastActiveAt: '2026-11-19T10:00:00.000Z',
    },
  });
  assert.equal(a.chains![0].balances[0].freeUnits, '15000000');
  assert.equal(a.chains![0].balances[0].lockedUnits, '2500000');
  assert.equal(a.chains![0].matcher, null, '"0" is not authorised');
  assert.deepEqual(a.chains![0].operators, [{ address: 'GBOT', perms: 6 }]);
  assert.deepEqual(a.chains![1].matcher, { maxPerOrderUnits: '1000000000', autoSettle: true });
  assert.equal(
    normalizeAccount({
      id: 'x',
      address: MERCHANT,
      displayName: null,
      merchantStatus: 'ACTIVE',
      createdAt: '2026-11-01T00:00:00Z',
    }).merchant,
    null,
    'a wallet without a name is not a merchant',
  );
});

test("an offer and a quote: the token's symbol and decimal amounts", () => {
  assert.equal(
    normalizeOffer({
      id: 'o',
      accountId: 'a',
      side: 'BUY_TOKEN',
      network: 'mainnet',
      token: USDC_SAC,
      tokenSymbol: 'USDC',
      currency: 'ARS',
      rails: ['ar_bank_transfer'],
      price: '1420.5',
      priceTtlSeconds: 600,
      minFiat: '1',
      maxFiat: '2',
      active: true,
      priceFresh: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-02T00:00:00Z',
    }).token,
    'USDC',
  );
  const q = normalizeQuote({
    id: 'q',
    side: 'BUY',
    network: 'mainnet',
    token: USDC_SAC,
    tokenSymbol: 'USDC',
    tokenDecimals: 7,
    currency: 'ARS',
    rail: 'ar_bank_transfer',
    price: '1431.98',
    fiatAmount: '50000',
    tokenAmount: '349168000',
    protocolFee: '1047500',
    integratorFee: '0',
    netAmount: '348120500',
    merchant: {
      displayName: 'Lumio',
      completedOrders: 312,
      cancelledOrders: 6,
      completionRate: 0.98,
      disputesLost: 0,
      medianReleaseSeconds: 185,
    },
    expiresAt: '2026-11-19T12:01:00Z',
  });
  assert.equal(q.token, 'USDC');
  assert.equal(q.tokenAmount, '34.9168');
  assert.equal(q.netAmount, '34.81205');
  assert.equal(q.merchant.completed, 312);
});

test("an order, from the client's and the merchant's views", () => {
  const base = {
    id: 'ord',
    kind: 'SALE',
    status: 'awaiting_payment',
    tier: 'public',
    network: 'mainnet',
    contract: MARKET_C,
    token: USDC_SAC,
    tokenSymbol: 'USDC',
    tokenDecimals: 7,
    currency: 'ARS',
    rail: 'ar_bank_transfer',
    price: '1400',
    fiatAmount: '140000',
    tokenAmount: '1000000000',
    netAmount: '997000000',
    protocolFeeBps: 30,
    integratorFeeBps: 0,
    bond: '0',
    sellerAddress: 'GSELLER',
    buyerAddress: MERCHANT,
    onchainId: '7',
    acceptDeadline: null,
    paymentDeadline: '2026-11-19T12:30:00Z',
    paidAt: null,
    endedAt: null,
    txHashes: {
      open: 'a1'.repeat(32),
      accept: null,
      paid: null,
      release: null,
      cancel: null,
      dispute: null,
      resolve: null,
    },
    createdAt: '2026-11-19T12:00:00Z',
    updatedAt: '2026-11-19T12:00:00Z',
  };
  const client = normalizeOrder({
    ...base,
    kind: 'BUY',
    merchant: { displayName: 'Lumio' },
    paymentDetails: {
      rail: 'ar_bank_transfer',
      holderName: 'Lumio SRL',
      details: { alias: 'lumio.ars' },
    },
    transactions: [],
  });
  assert.equal(client.kind, 'BUY');
  assert.equal(client.role, 'client');
  assert.equal(client.tokenAmount, '100');
  assert.equal(client.bond, null);
  assert.equal(client.buyer, MERCHANT);
  assert.deepEqual(client.deadlines, {
    acceptBy: null,
    payBy: '2026-11-19T12:30:00.000Z',
    settleBy: null,
  });
  assert.deepEqual(client.txs, { open: 'a1'.repeat(32) });
  assert.equal(client.paymentDetails?.holderName, 'Lumio SRL');
  assert.equal(
    normalizeOrder({
      ...base,
      kind: 'SELL',
      status: 'paid',
      settleDeadline: '2026-11-19T18:00:00Z',
    }).deadlines.settleBy,
    '2026-11-19T18:00:00.000Z',
    'a seller may dispute before it',
  );
  const merchant = normalizeOrder({
    ...base,
    kind: 'PAYOUT',
    bond: '100000000',
    merchantAccountId: 'acc',
    merchantSide: 'buyer',
    beneficiary: {
      holderName: 'Ana',
      document: '20329642330',
      rail: 'ar_bank_transfer',
      details: { cbu: '0170099222000001234561' },
    },
    payer: null,
  });
  assert.equal(merchant.role, 'merchant');
  assert.equal(merchant.bond, '10');
  assert.equal(
    merchant.paymentDetails?.document,
    '20329642330',
    "the merchant pays the beneficiary's account",
  );
  const unsigned = {
    network: 'mainnet',
    description: 'Lock 100 USDC in the order',
    xdr: 'AAAAAgAAAAA=',
    hash: 'b2'.repeat(32),
    expiresAt: '2026-11-19T12:05:00Z',
  };
  const sale = normalizeOrder({
    ...base,
    kind: 'SELL',
    status: 'pending',
    transactions: [unsigned],
  });
  assert.deepEqual(sale.transactions, [
    { ...unsigned, action: 'open_with_deposit', expiresAt: '2026-11-19T12:05:00.000Z' },
  ]);
  assert.deepEqual(
    normalizeOrder({
      ...base,
      kind: 'QR_PAY',
      status: 'pending',
      transaction: unsigned,
    }).transactions?.map((t) => t.action),
    ['open_with_deposit'],
    'a single `transaction` is read too',
  );
  assert.equal(
    normalizeOrder({
      ...base,
      kind: 'SELL',
      status: 'pending',
      transactions: [{ chainId: 8453, to: '0x1', data: '0xabcdef', value: '0' }],
    }).transactions,
    undefined,
    'EVM calldata is no transaction',
  );
  const qr = normalizeOrder({
    ...base,
    kind: 'QR_PAY',
    rail: 'ar_qr',
    merchantSide: 'buyer',
    qr: {
      payload: '000201010212',
      standard: 'ar-interoperable',
      merchantName: 'Cafe El Molino',
      merchantCity: 'Buenos Aires',
      amount: '12500.00',
      currency: 'ARS',
      reference: 'MESA-4',
    },
  });
  assert.equal(qr.kind, 'QR_PAY');
  assert.deepEqual(qr.qr, {
    payload: '000201010212',
    standard: 'ar-interoperable',
    merchantName: 'Cafe El Molino',
    merchantCity: 'Buenos Aires',
    amount: '12500.00',
    currency: 'ARS',
    reference: 'MESA-4',
  });
  // The payer's view: the QR's summary, never a payload to pay.
  assert.deepEqual(
    normalizeOrder({ ...base, qr: { standard: 'pix', merchantName: 'Padaria' } }).qr?.payload,
    '',
  );
  assert.equal(normalizeOrder({ ...base, qr: {} }).qr, null, 'nothing to show, no QR');
});

test('transfer matches, charges and payout batches', () => {
  const matches = normalizeTransferMatches({
    data: [
      {
        order: {
          id: 'o',
          kind: 'BUY',
          status: 'paid',
          network: 'mainnet',
          tokenSymbol: 'USDC',
          tokenDecimals: 7,
          tokenAmount: '10000000',
          merchantSide: 'seller',
          fiatAmount: '1400',
          currency: 'ARS',
          rail: 'ar_bank_transfer',
          price: '1400',
          createdAt: '2026-11-19T12:00:00Z',
        },
        score: 3,
        matchedOn: ['amount', 'name', 'document'],
        transaction: {
          network: 'mainnet',
          description: 'Release',
          xdr: 'AAAAAgAAAAA=',
          hash: 'c3'.repeat(32),
          expiresAt: '2026-11-19T12:05:00Z',
        },
      },
    ],
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].transaction.action, 'release');
  assert.equal(matchConfidence(3), 1);
  assert.equal(matchConfidence(1), 1 / 3);
  const c = normalizeCharge({
    id: 'c',
    currency: 'ARS',
    fiatAmount: '85000',
    network: 'mainnet',
    token: USDC_SAC,
    tokenSymbol: 'USDC',
    recipientAccountId: 'acc',
    recipientAddress: MERCHANT,
    description: null,
    status: 'open',
    url: 'https://midpoint.example/c/c',
    multiUse: false,
    expiresAt: '2026-11-20T12:00:00Z',
    paidAt: null,
    paidCount: 0,
    createdAt: '2026-11-19T12:00:00Z',
  });
  assert.equal(c.token, 'USDC');
  assert.equal(c.recipient, MERCHANT);
  assert.equal(c.qr, null);
  const withQr = normalizeCharge({
    id: 'c',
    status: 'open',
    qr: 'data:image/png;base64,iVBORw0KGgo=',
    payeeName: 'Tienda Mamoré',
  });
  assert.deepEqual(
    [withQr.qr, withQr.payeeName],
    ['data:image/png;base64,iVBORw0KGgo=', 'Tienda Mamoré'],
  );
  const b = normalizePayoutBatch({
    id: 'b',
    network: 'mainnet',
    token: USDC_SAC,
    accountId: 'acc',
    status: 'partially_completed',
    itemCount: 3,
    orders: [
      {
        id: 'o1',
        kind: 'PAYOUT',
        status: 'completed',
        tokenDecimals: 7,
        tokenAmount: '1',
        currency: 'ARS',
        fiatAmount: '1000',
        rail: 'ar_bank_transfer',
        price: '1',
        merchantSide: 'buyer',
        beneficiary: { holderName: 'Ana', details: {} },
        externalReference: 'inv-1',
        onchainId: '4107',
        sellerAddress: MERCHANT,
        createdAt: '2026-11-19T12:00:00Z',
      },
    ],
    failedItems: [
      {
        index: 1,
        currency: 'CLP',
        fiatAmount: '95000',
        externalReference: 'inv-2',
        reason: 'No merchant',
      },
    ],
    createdAt: '2026-11-19T12:00:00Z',
  });
  assert.equal(b.status, 'partial');
  assert.deepEqual(
    [b.items[0].onchainId, b.items[0].seller, b.items[1].onchainId ?? null],
    ['4107', MERCHANT, null],
    'an opened payout carries what its release is checked against',
  );
  assert.equal(b.itemCount, 3);
  assert.deepEqual(
    b.items.map((i) => [i.status, i.beneficiaryName, i.error]),
    [
      ['completed', 'Ana', null],
      ['rejected', '-', 'No merchant'],
    ],
  );
  assert.equal(
    normalizePayoutBatch({
      id: 'b',
      status: 'processing',
      itemCount: 2,
      orders: [],
      failedItems: [],
    }).itemCount,
    2,
    'a list answers without its orders',
  );
});

test("requests: base units and the server's argument names", () => {
  assert.deepEqual(txArgs('deposit', { token: 'USDC', amount: '250.5' }, 7), {
    token: 'USDC',
    amount: '2505000000',
  });
  assert.deepEqual(txArgs('set_matcher', { maxPerOrder: '1000', autoSettle: false }, 7), {
    maxPerOrder: '10000000000',
    autoSettle: false,
  });
  assert.deepEqual(txArgs('set_operator', { operator: MERCHANT, perms: 6 }, 7), {
    operator: MERCHANT,
    permissions: 6,
  });
  assert.deepEqual(txArgs('release', { orderId: 'o', reference: 'x' }, 7), { orderId: 'o' });
  assert.deepEqual(txArgs('mark_paid', { orderId: 'o', reference: 'x' }, 7), {
    orderId: 'o',
    reference: 'x',
  });
});
