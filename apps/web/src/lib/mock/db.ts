/* The mock API's state: what a real API and the Stellar network would hold, in this tab's memory,
   saved to sessionStorage so a reload (or a dev hot reload) keeps the session and every order.
   Orders move on their own as time passes (a merchant accepting, paying, releasing), the way the
   indexer would move them from contract events; `chain` holds the accounts, trustlines and
   balances that submitted transactions change (src/lib/mock/chain.ts). */
import { orderRef } from '@/lib/p2p/order-ref';
import {
  BOT,
  BUSINESS_WALLET,
  FRIEND,
  HANDLES,
  SHOP_OWNER,
  MERCHANT_WALLET,
  MERCHANTS,
  NETWORKS,
  OPS_MEMBER,
  ORGS,
  OTHER_MERCHANT,
  RULES,
  USER,
} from '@/lib/mock/fixtures';
import { DEMO_QRS } from '@/lib/mock/qr';
import { receiptPdf } from '@/lib/mock/receipt';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Wire = Record<string, any>;

/** An account on the mock network: whether it exists, its sequence, XLM, and its trustlines
    (null: none) with their balance, all in base units. */
export interface ChainAccount {
  exists: boolean;
  seq: string;
  xlm: string;
  trust: Record<string, string | null>;
}

export interface MockState {
  v: number;
  session: { address: string } | null;
  chain: {
    accounts: Record<string, ChainAccount>;
    submissions: Record<string, Wire>;
  };
  handles: Record<string, string>;
  transfers: Wire[];
  chargePayments: Record<string, Wire>;
  challenges10: Record<string, Wire>;
  orgs: Wire[];
  members: Record<string, Wire[]>;
  orders: Wire[];
  quotes: Record<string, Wire>;
  accounts: Wire[];
  challenges: Record<string, Wire>;
  methods: Wire[];
  offers: Wire[];
  charges: Wire[];
  payouts: Wire[];
  keys: Wire[];
  webhooks: Wire[];
  deliveries: Wire[];
  payerTokens: Record<string, string>;
  nextOnchainId: number;
  /* Orders' chat messages (`_data`: an attachment's base64, never in a list). */
  messages: Wire[];
}

const VERSION = 9;
const STORAGE_KEY = 'midpoint.mock';

export const now = () => Date.now();
export const iso = (ms: number) => new Date(ms).toISOString();
export const rid = (prefix: string, n = 12) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return `${prefix}_${[...bytes].map((b) => (b % 36).toString(36)).join('')}`;
};
export const hash32 = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
export const refOf = (id: string) => orderRef(id)!;
export const units = (decimal: number, decimals = 7) =>
  BigInt(Math.round(decimal * 10 ** decimals)).toString();

const MIN = 60_000;

function token(network: string, symbol = 'USDC') {
  const n = NETWORKS.find((x) => x.id === network) ?? NETWORKS[0];
  return n.tokens.find((t) => t.symbol === symbol) ?? n.tokens[0];
}

/** One order in the API's wire shape, with the mock's private fields (`_...`). */
export function makeOrder(o: {
  kind: 'BUY' | 'SELL' | 'CHARGE' | 'PAYOUT' | 'QR_PAY';
  status: string;
  owner: string; // 'app' or an organization id: who created it
  merchantOrg?: string | null; // the organization whose merchant took it
  network?: string;
  symbol?: string;
  fiat: number;
  currency: string;
  rail: string;
  price: number;
  buyer: string;
  seller: string;
  merchant?: Wire;
  createdAgoMin?: number;
  extra?: Wire;
  auto?: boolean;
}): Wire {
  const created = now() - (o.createdAgoMin ?? 0) * MIN;
  const network = o.network ?? NETWORKS[0].id;
  const t = token(network, o.symbol);
  const tokens = Math.floor((o.fiat / o.price) * 100) / 100;
  const id = crypto.randomUUID();
  const bonded = o.kind === 'SELL' || o.kind === 'PAYOUT' || o.kind === 'QR_PAY';
  return {
    id,
    ref: refOf(id),
    kind: o.kind,
    status: o.status,
    network,
    token: t.contract,
    tokenSymbol: t.symbol,
    tokenDecimals: t.decimals,
    tokenAmount: units(tokens, t.decimals),
    fiatAmount: o.fiat.toFixed(o.currency === 'CLP' ? 0 : 2),
    currency: o.currency,
    rail: o.rail,
    price: String(o.price),
    feeBps: RULES.protocolFeeBps,
    integratorFeeBps: 0,
    buyerAddress: o.buyer,
    sellerAddress: o.seller,
    bond: bonded ? units(tokens * 0.1, t.decimals) : '0',
    merchant: o.merchant ?? MERCHANTS[0],
    paymentDeadline: null,
    acceptDeadline: null,
    settleDeadline: null,
    paymentDetails: null,
    beneficiary: null,
    payer: null,
    paidReference: null,
    onchainId: null,
    txHashes: {},
    chargeId: null,
    payoutBatchId: null,
    externalReference: null,
    createdAt: iso(created),
    updatedAt: iso(created),
    _owner: o.owner,
    _merchantOrg: o.merchantOrg ?? null,
    _auto: o.auto ?? true,
    _t: {},
    ...o.extra,
  };
}

function seed(): MockState {
  const t = now();
  const s: MockState = {
    v: VERSION,
    session: null,
    orgs: ORGS.map((o) => ({ ...o })),
    members: {
      org_nortecambios: [
        {
          id: 'mem_norte_owner',
          address: MERCHANT_WALLET,
          role: 'owner',
          label: null,
          addedAt: '2026-09-02T13:00:00.000Z',
        },
        {
          id: 'mem_norte_ops',
          address: OPS_MEMBER,
          role: 'admin',
          label: 'Operaciones',
          addedAt: '2026-09-10T18:00:00.000Z',
        },
      ],
      org_tiendamamore: [
        {
          id: 'mem_mamore_owner',
          address: SHOP_OWNER,
          role: 'owner',
          label: 'Dueña',
          addedAt: '2026-10-11T15:30:00.000Z',
        },
        {
          id: 'mem_mamore_demo',
          address: MERCHANT_WALLET,
          role: 'admin',
          label: null,
          addedAt: '2026-10-12T09:00:00.000Z',
        },
        {
          id: 'mem_mamore_business',
          address: BUSINESS_WALLET,
          role: 'admin',
          label: null,
          addedAt: '2026-10-12T09:00:00.000Z',
        },
      ],
    },
    orders: [],
    quotes: {},
    accounts: [
      {
        id: 'acc_norte_treasury',
        _org: 'org_nortecambios',
        address: MERCHANT_WALLET,
        label: 'Tesorería',
        verifiedAt: '2026-09-02T13:10:00.000Z',
        createdAt: '2026-09-02T13:10:00.000Z',
        displayName: 'Norte Cambios',
        merchantStatus: 'ACTIVE',
        stats: {
          completedOrders: 1284,
          cancelledOrders: 9,
          disputesLost: 1,
          medianReleaseSeconds: 140,
          lastActiveAt: iso(t - 3 * MIN),
        },
        networks: [
          {
            network: 'testnet',
            balances: [
              {
                token: token('testnet').contract,
                symbol: 'USDC',
                decimals: 7,
                freeUnits: units(12450.5),
                lockedUnits: units(233.45),
              },
            ],
            matcher: { maxPerOrder: units(2000), autoSettle: false },
            operators: { [BOT]: 6 },
          },
        ],
      },
      {
        id: 'acc_mamore_collect',
        _org: 'org_tiendamamore',
        address: BUSINESS_WALLET,
        label: 'Cobros',
        verifiedAt: '2026-10-11T16:00:00.000Z',
        createdAt: '2026-10-11T16:00:00.000Z',
        networks: [
          {
            network: 'testnet',
            balances: [
              {
                token: token('testnet').contract,
                symbol: 'USDC',
                decimals: 7,
                freeUnits: units(5000),
                lockedUnits: units(410.2),
              },
            ],
            matcher: { maxPerOrder: units(1000), autoSettle: false },
            operators: {},
          },
        ],
      },
    ],
    challenges: {},
    methods: [
      {
        id: 'pm_bob_main',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        currency: 'BOB',
        rail: 'bo_bank_transfer',
        label: 'Banco Unión',
        holderName: 'Norte Cambios SRL',
        document: '1020304025',
        details: {
          bank: 'Banco Unión',
          accountType: 'checking',
          accountNumber: '1000023456789',
          documentType: 'NIT',
          documentNumber: '1020304025',
        },
        active: true,
        createdAt: '2026-09-01T14:00:00.000Z',
        summary: 'Banco Unión ••••6789',
      },
      {
        id: 'pm_pen_main',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        currency: 'PEN',
        rail: 'pe_bank_transfer',
        label: 'Cuenta en Perú',
        holderName: 'Cambios Norte SAC',
        document: '20100070970',
        details: {
          cci: '00219300123456789012',
          documentType: 'RUC',
          documentNumber: '20100070970',
        },
        active: true,
        createdAt: '2026-09-02T14:00:00.000Z',
        summary: 'CCI ••••9012',
      },
      {
        id: 'pm_brl_pix',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        currency: 'BRL',
        rail: 'br_pix',
        label: 'PIX',
        holderName: 'Norte Câmbio Ltda',
        document: null,
        details: { keyType: 'email', key: 'pix@nortecambios.example' },
        active: true,
        createdAt: '2026-09-20T14:00:00.000Z',
        summary: 'email pix@nortecambios.example',
      },
      {
        id: 'pm_mxn_spei',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        currency: 'MXN',
        rail: 'mx_spei',
        label: null,
        holderName: 'Cambios del Norte SA',
        document: null,
        details: { clabe: '002010077777777771' },
        active: false,
        createdAt: '2026-10-01T14:00:00.000Z',
        summary: 'CLABE ···· 7771',
      },
    ],
    offers: [
      {
        id: 'off_bob_sell',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        side: 'SELL_TOKEN',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        currency: 'BOB',
        rails: ['bo_bank_transfer'],
        price: '12.05',
        priceUpdatedAt: iso(t - 4 * MIN),
        priceTtlSeconds: 3600,
        minFiat: '70',
        maxFiat: '14000',
        active: true,
        createdAt: '2026-09-03T12:00:00.000Z',
      },
      {
        id: 'off_bob_buy',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        side: 'BUY_TOKEN',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        currency: 'BOB',
        rails: ['bo_bank_transfer'],
        price: '11.85',
        priceUpdatedAt: iso(t - 4 * MIN),
        priceTtlSeconds: 3600,
        minFiat: '70',
        maxFiat: '10000',
        active: true,
        createdAt: '2026-09-03T12:00:00.000Z',
      },
      {
        id: 'off_brl_sell',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        side: 'SELL_TOKEN',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        currency: 'BRL',
        rails: ['br_pix'],
        price: '5.47',
        priceUpdatedAt: iso(t - 9 * MIN),
        priceTtlSeconds: 900,
        minFiat: '50',
        maxFiat: '25000',
        active: true,
        createdAt: '2026-09-21T12:00:00.000Z',
      },
      {
        id: 'off_mxn_sell',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        side: 'SELL_TOKEN',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        currency: 'MXN',
        rails: ['mx_spei'],
        price: '18.70',
        priceUpdatedAt: iso(t - 190 * MIN),
        priceTtlSeconds: 900,
        minFiat: '200',
        maxFiat: '60000',
        active: true,
        createdAt: '2026-10-02T12:00:00.000Z',
      },
      {
        id: 'off_brl_buy',
        _org: 'org_nortecambios',
        accountId: 'acc_norte_treasury',
        side: 'BUY_TOKEN',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        currency: 'BRL',
        rails: ['br_pix'],
        price: '5.36',
        priceUpdatedAt: iso(t - 600 * MIN),
        priceTtlSeconds: 3600,
        minFiat: '50',
        maxFiat: '20000',
        active: false,
        createdAt: '2026-09-21T12:00:00.000Z',
      },
    ],
    charges: [
      {
        id: 'ch_pedido1042',
        _org: 'org_tiendamamore',
        currency: 'BOB',
        fiatAmount: '250.00',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        recipientAddress: BUSINESS_WALLET,
        description: 'Pedido #1042: dos docenas de cuñapés',
        status: 'open',
        multiUse: false,
        expiresAt: iso(t + 22 * 60 * MIN),
        payeeName: 'Tienda Mamoré',
        paidAt: null,
        orders: 0,
        createdAt: iso(t - 40 * MIN),
      },
      {
        id: 'ch_cuotaclub',
        _org: 'org_tiendamamore',
        currency: 'BOB',
        fiatAmount: '80.00',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        recipientAddress: BUSINESS_WALLET,
        description: 'Cuota mensual del club de lectura',
        status: 'open',
        multiUse: true,
        expiresAt: null,
        payeeName: 'Tienda Mamoré',
        paidAt: null,
        orders: 7,
        createdAt: '2026-11-01T12:00:00.000Z',
      },
      {
        id: 'ch_pedido1039',
        _org: 'org_tiendamamore',
        currency: 'BOB',
        fiatAmount: '480.00',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        recipientAddress: BUSINESS_WALLET,
        description: 'Pedido #1039',
        status: 'paid',
        multiUse: false,
        expiresAt: null,
        payeeName: 'Tienda Mamoré',
        paidAt: iso(t - 26 * 60 * MIN),
        orders: 1,
        createdAt: iso(t - 28 * 60 * MIN),
      },
      {
        id: 'ch_pedido1031',
        _org: 'org_tiendamamore',
        currency: 'BRL',
        fiatAmount: '320.00',
        network: 'testnet',
        token: token('testnet').contract,
        tokenSymbol: 'USDC',
        recipientAddress: BUSINESS_WALLET,
        description: 'Pedido #1031',
        status: 'expired',
        multiUse: false,
        expiresAt: iso(t - 3 * 24 * 60 * MIN),
        payeeName: 'Tienda Mamoré',
        paidAt: null,
        orders: 0,
        createdAt: iso(t - 4 * 24 * 60 * MIN),
      },
    ],
    payouts: [],
    keys: [
      {
        id: 'key_bot',
        _org: 'org_nortecambios',
        name: 'Bot de precios',
        prefix: 'pk_test_7f2c',
        tier: 'test',
        scopes: ['p2p:read', 'p2p:write'],
        createdAt: '2026-09-05T10:00:00.000Z',
        lastUsedAt: iso(t - 2 * MIN),
        revokedAt: null,
      },
      {
        id: 'key_bot_live',
        _org: 'org_nortecambios',
        name: 'Bot de precios',
        prefix: 'pk_live_91ad',
        tier: 'live',
        scopes: ['p2p:read', 'p2p:write'],
        createdAt: '2026-09-12T10:00:00.000Z',
        lastUsedAt: iso(t - 1 * MIN),
        revokedAt: null,
      },
      {
        id: 'key_shop',
        _org: 'org_tiendamamore',
        name: 'Tienda online',
        prefix: 'pk_live_c41e',
        tier: 'live',
        scopes: ['p2p:read', 'p2p:write'],
        createdAt: '2026-10-12T10:00:00.000Z',
        lastUsedAt: iso(t - 55 * MIN),
        revokedAt: null,
      },
    ],
    webhooks: [
      {
        id: 'wh_bot',
        _org: 'org_nortecambios',
        url: 'https://bot.nortecambios.example/hooks/midpoint',
        description: 'Bot de liberación',
        events: [
          'P2P_ORDER_CREATED',
          'P2P_ORDER_PAID',
          'P2P_ORDER_COMPLETED',
          'P2P_ORDER_CANCELLED',
          'P2P_ORDER_EXPIRED',
          'P2P_ORDER_DISPUTED',
        ],
        active: true,
        createdAt: '2026-09-05T10:30:00.000Z',
      },
      {
        id: 'wh_shop',
        _org: 'org_tiendamamore',
        url: 'https://tiendamamore.example/api/midpoint',
        description: null,
        events: ['P2P_CHARGE_SUCCEEDED', 'P2P_PAYOUT_BATCH_COMPLETED'],
        active: true,
        createdAt: '2026-10-12T10:30:00.000Z',
      },
    ],
    deliveries: [
      {
        id: 'dlv_1',
        _endpoint: 'wh_bot',
        type: 'P2P_ORDER_PAID',
        eventId: 'evt_demo_1',
        status: 'delivered',
        attempts: 1,
        lastStatus: 200,
        createdAt: iso(t - 6 * MIN),
        nextAttemptAt: null,
      },
      {
        id: 'dlv_2',
        _endpoint: 'wh_bot',
        type: 'P2P_ORDER_CREATED',
        eventId: 'evt_demo_2',
        status: 'delivered',
        attempts: 1,
        lastStatus: 200,
        createdAt: iso(t - 9 * MIN),
        nextAttemptAt: null,
      },
      {
        id: 'dlv_3',
        _endpoint: 'wh_bot',
        type: 'P2P_ORDER_COMPLETED',
        eventId: 'evt_demo_3',
        status: 'failed',
        attempts: 3,
        lastStatus: 502,
        lastError: 'Bad Gateway',
        createdAt: iso(t - 70 * MIN),
        nextAttemptAt: iso(t + 8 * MIN),
      },
      {
        id: 'dlv_4',
        _endpoint: 'wh_shop',
        type: 'P2P_CHARGE_SUCCEEDED',
        eventId: 'evt_demo_4',
        status: 'delivered',
        attempts: 1,
        lastStatus: 204,
        createdAt: iso(t - 26 * 60 * MIN),
        nextAttemptAt: null,
      },
    ],
    payerTokens: {},
    nextOnchainId: 4100,
    messages: [],
    chain: {
      accounts: {
        [USER]: { exists: true, seq: '100', xlm: '0', trust: { USDC: units(248.35) } },
        [FRIEND]: { exists: true, seq: '100', xlm: '0', trust: { USDC: units(40) } },
        [MERCHANT_WALLET]: {
          exists: true,
          seq: '100',
          xlm: units(5),
          trust: { USDC: units(3100) },
        },
        [BUSINESS_WALLET]: { exists: true, seq: '100', xlm: '0', trust: { USDC: units(900) } },
        [OTHER_MERCHANT]: { exists: true, seq: '100', xlm: '0', trust: { USDC: units(50000) } },
      },
      submissions: {},
    },
    handles: { ...HANDLES },
    transfers: [],
    chargePayments: {},
    challenges10: {},
  };

  // The merchant's orders to work on, and its history.
  const m = (o: Omit<Parameters<typeof makeOrder>[0], 'owner'>) => {
    const order = makeOrder({
      merchantOrg: 'org_nortecambios',
      owner: 'org_other',
      auto: false,
      ...o,
    });
    order.onchainId = String(s.nextOnchainId++);
    order.txHashes = { open: hash32() };
    s.orders.push(order);
    return order;
  };
  const user = FRIEND;
  const bobAccount = {
    rail: 'bo_bank_transfer',
    holderName: 'Norte Cambios SRL',
    document: '1020304025',
    details: {
      bank: 'Banco Unión',
      accountType: 'checking',
      accountNumber: '1000023456789',
      documentType: 'NIT',
      documentNumber: '1020304025',
    },
  };
  m({
    kind: 'BUY',
    status: 'awaiting_payment',
    fiat: 1500,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 12.05,
    buyer: user,
    seller: MERCHANT_WALLET,
    createdAgoMin: 8,
    extra: {
      paymentDeadline: iso(t + 22 * MIN),
      payer: { name: 'Lucía Fernández', document: '4829175' },
      paymentDetails: bobAccount,
    },
  });
  m({
    kind: 'BUY',
    status: 'paid',
    fiat: 850,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 12.05,
    buyer: user,
    seller: MERCHANT_WALLET,
    createdAgoMin: 14,
    extra: {
      paymentDeadline: iso(t + 16 * MIN),
      payer: { name: 'Marcelo Gutiérrez', document: '5938271' },
      paidReference: 'TRX-48213',
      paymentDetails: bobAccount,
    },
  });
  m({
    kind: 'SELL',
    status: 'awaiting_acceptance',
    fiat: 497.7,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 11.85,
    buyer: MERCHANT_WALLET,
    seller: user,
    createdAgoMin: 1,
    extra: {
      acceptDeadline: iso(t + 4 * MIN),
      beneficiary: {
        rail: 'bo_bank_transfer',
        holderName: 'Daniela Rojas',
        document: '6123987',
        details: {
          bank: 'Banco Mercantil Santa Cruz',
          accountType: 'savings',
          accountNumber: '4012345678',
          documentType: 'CI',
          documentNumber: '6123987',
        },
      },
    },
  });
  m({
    kind: 'SELL',
    status: 'awaiting_payment',
    fiat: 1072,
    currency: 'BRL',
    rail: 'br_pix',
    price: 5.36,
    buyer: MERCHANT_WALLET,
    seller: user,
    createdAgoMin: 6,
    extra: {
      paymentDeadline: iso(t + 25 * MIN),
      beneficiary: {
        rail: 'br_pix',
        holderName: 'João Silva',
        document: '52998224725',
        details: { keyType: 'cpf', key: '52998224725' },
      },
    },
  });
  m({
    kind: 'BUY',
    status: 'completed',
    fiat: 2977,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 12.05,
    buyer: user,
    seller: MERCHANT_WALLET,
    createdAgoMin: 26 * 60,
    extra: {
      payer: { name: 'Carla Méndez', document: '7712345' },
      txHashes: { open: hash32(), paid: hash32(), release: hash32() },
    },
  });
  m({
    kind: 'CHARGE',
    status: 'completed',
    fiat: 480,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 12.05,
    buyer: BUSINESS_WALLET,
    seller: MERCHANT_WALLET,
    createdAgoMin: 28 * 60,
    extra: { payer: { name: 'Diego Paz', document: '5544332' }, chargeId: 'ch_pedido1039' },
  });
  m({
    kind: 'SELL',
    status: 'cancelled',
    fiat: 290,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 11.85,
    buyer: MERCHANT_WALLET,
    seller: user,
    createdAgoMin: 50 * 60,
  });
  m({
    kind: 'BUY',
    status: 'expired',
    fiat: 400,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 12.05,
    buyer: user,
    seller: MERCHANT_WALLET,
    createdAgoMin: 72 * 60,
  });
  m({
    kind: 'BUY',
    status: 'disputed',
    fiat: 2200,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 12.05,
    buyer: user,
    seller: MERCHANT_WALLET,
    createdAgoMin: 30 * 60,
    extra: { payer: { name: 'Pablo Ortiz', document: '6677889' }, paidReference: '000981223' },
  });

  // The business's payouts: one batch half-way through.
  const batchId = 'pob_novpayroll';
  const ben = (name: string, bank: string, accountNumber: string, ci: string) => ({
    rail: 'bo_bank_transfer',
    holderName: name,
    document: ci,
    details: {
      bank,
      accountType: 'savings',
      accountNumber,
      documentType: 'CI',
      documentNumber: ci,
    },
  });
  const p = (status: string, fiat: number, b: Wire, ref: string) => {
    const order = makeOrder({
      kind: 'PAYOUT',
      status,
      owner: 'org_tiendamamore',
      merchantOrg: 'org_other',
      fiat,
      currency: 'BOB',
      rail: 'bo_bank_transfer',
      price: 11.85,
      buyer: OTHER_MERCHANT,
      seller: BUSINESS_WALLET,
      createdAgoMin: 90,
      extra: {
        beneficiary: b,
        payoutBatchId: batchId,
        externalReference: ref,
        txHashes: { open: hash32() },
      },
    });
    order.onchainId = String(s.nextOnchainId++);
    if (status === 'paid') {
      order.paidReference = 'TRF-55120';
      order.settleDeadline = null;
    }
    s.orders.push(order);
    return order;
  };
  const items = [
    p('completed', 1800, ben('Ana Flores', 'Banco Unión', '1000023456781', '6543210'), 'nov-001'),
    p('completed', 950, ben('Jorge Mamani', 'Banco BISA', '0012345678', '3456789'), 'nov-002'),
    p('paid', 1200, ben('Valeria Cruz', 'Banco Ganadero', '1310123456', '8765432'), 'nov-003'),
  ];
  s.payouts.push({
    id: batchId,
    _org: 'org_tiendamamore',
    network: 'testnet',
    token: token('testnet').contract,
    tokenSymbol: 'USDC',
    accountId: 'acc_mamore_collect',
    _orderIds: items.map((o) => o.id),
    failedItems: [
      {
        index: 3,
        currency: 'BOB',
        fiatAmount: '500',
        rail: 'bo_bank_transfer',
        holderName: 'Luis Peña',
        externalReference: 'nov-004',
        reason: 'No merchant takes this amount right now.',
      },
    ],
    createdAt: iso(t - 90 * MIN),
  });

  // A QR payment the merchant is serving: it pays a shop's PIX QR from its banking app.
  const qrOrder = makeOrder({
    kind: 'QR_PAY',
    status: 'awaiting_payment',
    owner: 'app',
    merchantOrg: 'org_nortecambios',
    auto: false,
    fiat: 85,
    currency: 'BRL',
    rail: 'br_pix_qr',
    price: 5.36,
    buyer: MERCHANT_WALLET,
    seller: FRIEND,
    createdAgoMin: 2,
    extra: {
      paymentDeadline: iso(t + 8 * MIN),
      _qr: DEMO_QRS.kiosk,
      _qrAmount: '85.00',
      txHashes: { open: hash32(), accept: hash32() },
    },
  });
  qrOrder.onchainId = String(s.nextOnchainId++);
  s.orders.push(qrOrder);

  // The app user's history: money in and out, a purchase and a sale.
  const transfer = (o: {
    from: string;
    to: string;
    amount: number;
    note: string | null;
    agoMin: number;
    fromHandle?: string | null;
    toHandle?: string | null;
  }) => {
    const at = iso(t - o.agoMin * MIN);
    s.transfers.push({
      id: crypto.randomUUID(),
      network: NETWORKS[0].id,
      token: 'USDC',
      amount: units(o.amount),
      from: o.from,
      fromHandle: o.fromHandle ?? null,
      to: o.to,
      toHandle: o.toHandle ?? null,
      note: o.note,
      status: 'COMPLETED',
      hash: hash32(),
      createdAt: at,
      completedAt: at,
    });
  };
  transfer({
    from: FRIEND,
    to: USER,
    amount: 35,
    note: 'Almuerzo del sábado',
    agoMin: 50,
    fromHandle: 'lucia',
  });
  transfer({
    from: USER,
    to: FRIEND,
    amount: 12.5,
    note: 'Café',
    agoMin: 26 * 60,
    toHandle: 'lucia',
  });
  // A payment from outside the app: no handle.
  transfer({ from: OTHER_MERCHANT, to: USER, amount: 100, note: null, agoMin: 3 * 24 * 60 });
  const app = (o: Omit<Parameters<typeof makeOrder>[0], 'owner' | 'merchantOrg'>) => {
    const order = makeOrder({ owner: 'app', merchantOrg: 'org_other', auto: false, ...o });
    order.onchainId = String(s.nextOnchainId++);
    order.txHashes = { open: hash32(), release: hash32() };
    s.orders.push(order);
    return order;
  };
  app({
    kind: 'BUY',
    status: 'completed',
    fiat: 1500,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 12.05,
    buyer: USER,
    seller: OTHER_MERCHANT,
    createdAgoMin: 2 * 24 * 60,
    extra: { payer: { name: 'Sofía Ruiz', document: '6543210' } },
  });
  app({
    kind: 'SELL',
    status: 'completed',
    fiat: 290,
    currency: 'BOB',
    rail: 'bo_bank_transfer',
    price: 11.85,
    buyer: OTHER_MERCHANT,
    seller: USER,
    createdAgoMin: 5 * 24 * 60,
  });
  // A send that never opened (its signature never landed): nothing moved, the row is struck out.
  const never = app({
    kind: 'SELL',
    status: 'failed',
    fiat: 37,
    currency: 'PEN',
    rail: 'pe_bank_transfer',
    price: 3.7,
    buyer: OTHER_MERCHANT,
    seller: USER,
    createdAgoMin: 3 * 60,
  });
  never.onchainId = null;
  never.txHashes = {};
  return s;
}

let state: MockState | null = null;

export function db(): MockState {
  if (state) return state;
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && raw.v === VERSION) state = raw as MockState;
  } catch {
    /* fresh state below */
  }
  state ??= seed();
  return state;
}

export function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the state lives in memory */
  }
}

/** Start over with the seed data (the demo banner's reset), keeping the signed-in wallet. */
export function resetMock() {
  const session = state?.session ?? null;
  state = seed();
  state.session = session;
  save();
}

/** The wire shape without the mock's private fields. */
export function pub<T extends Wire>(o: T): Wire {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
}

/** Move an order on as its counterpart would (the merchant accepting, paying, releasing), and
    expire it when its deadline passed. Called on every read. */
export function tick(o: Wire): Wire {
  const t = now();
  const w = {
    paymentSeconds: RULES.buyPaymentSeconds,
    sellPaymentSeconds: RULES.sellPaymentSeconds,
    settleSeconds: RULES.sellSettleSeconds,
  };
  const T = o._t ?? (o._t = {});
  const at = (ms: number) => iso(ms);
  const touch = () => (o.updatedAt = at(t));
  if (o.status === 'awaiting_payment' && o.paymentDeadline && Date.parse(o.paymentDeadline) < t) {
    o.status = 'expired';
    touch();
    return o;
  }
  if (o.status === 'awaiting_acceptance' && o.acceptDeadline && Date.parse(o.acceptDeadline) < t) {
    o.status = 'expired';
    touch();
    refundSeller(o);
    return o;
  }
  if (!o._auto) return o;
  const created = Date.parse(o.createdAt);
  const buyLike = o.kind === 'BUY' || o.kind === 'CHARGE';
  if (buyLike) {
    if (o.status === 'pending' && t - created > 1500) {
      o.status = 'awaiting_payment';
      o.onchainId = String(db().nextOnchainId++);
      o.paymentDeadline = at(created + w.paymentSeconds * 1000);
      o.txHashes = { ...o.txHashes, open: hash32() };
      touch();
    }
    if (o.status === 'paid' && T.paid && t - T.paid > 6000) {
      o.status = 'completed';
      o.txHashes = { ...o.txHashes, release: hash32() };
      touch();
      onCompleted(o);
    }
    return o;
  }
  // A sale, a QR payment or a payout: the merchant accepts, pays the beneficiary (or the shop's
  // QR) and marks it paid.
  const qr = o.kind === 'QR_PAY';
  if (o.status === 'awaiting_acceptance' && T.opened && t - T.opened > 4000) {
    o.status = 'awaiting_payment';
    // Time-based, not read-based: the merchant accepted four seconds after the order opened.
    T.accepted = Math.min(t, T.opened + 4000);
    o.paymentDeadline = at(
      T.accepted + (qr ? RULES.qrPaymentSeconds : w.sellPaymentSeconds) * 1000,
    );
    o.txHashes = { ...o.txHashes, accept: hash32() };
    touch();
  }
  if (o.status === 'awaiting_payment' && T.accepted && t - T.accepted > 6000) {
    o.status = 'paid';
    T.paid = t;
    o.paidReference = `TRF-${Math.floor(10000 + Math.random() * 89999)}`;
    o.settleDeadline =
      o.kind === 'SELL'
        ? at(t + w.settleSeconds * 1000)
        : qr
          ? at(t + RULES.qrSettleSeconds * 1000)
          : null;
    o.txHashes = { ...o.txHashes, paid: hash32() };
    touch();
    merchantReceipt(o, t);
  }
  return o;
}

/* --- The chat: what the merchant sends on its own. --- */

const RAIL_NAMES: Record<string, string> = {
  bo_bank_transfer: 'Transferencia bancaria',
  ar_bank_transfer: 'Transferencia (CBU, CVU o alias)',
  ar_qr: 'QR interoperable',
  br_pix: 'PIX',
  br_pix_qr: 'QR de PIX',
};

/** A chat message on order `o`, `at` milliseconds (a reply shows a few seconds later). */
export function addMessage(
  o: Wire,
  from: 'creator' | 'merchant',
  input: { text?: string; attachment?: { name: string; contentType: string; data: string } },
  at = now(),
): Wire {
  const a = input.attachment;
  const m: Wire = {
    id: `msg_${Math.random().toString(36).slice(2, 12)}`,
    orderId: o.id,
    from,
    kind: a ? 'receipt' : 'text',
    text: input.text?.trim() || null,
    attachment: a
      ? { name: a.name, contentType: a.contentType, size: Math.floor((a.data.length * 3) / 4) }
      : null,
    _data: a?.data,
    createdAt: iso(at),
  };
  db().messages.push(m);
  return m;
}

/** The mock merchant's receipt once it paid the person (a sale) or the shop (a QR payment). */
function merchantReceipt(o: Wire, t: number) {
  const ben = (o.beneficiary ?? {}) as Wire;
  const account = Object.values((ben.details ?? {}) as Record<string, string>).find((v) =>
    /\d{6,}/.test(v),
  );
  const data = receiptPdf([
    'Comprobante de transferencia',
    'Norte Cambios SRL',
    `Fecha: ${new Date(t).toLocaleString('es-BO')}`,
    `Monto: ${o.fiatAmount} ${o.currency}`,
    `Medio: ${RAIL_NAMES[o.rail] ?? o.rail}`,
    ...(o.kind === 'QR_PAY'
      ? [`Comercio: ${(o._shopName as string) ?? 'QR del comercio'}`]
      : [
          `Beneficiario: ${ben.holderName ?? '-'}${account ? ` (cuenta ****${account.slice(-4)})` : ''}`,
        ]),
    `Referencia: ${String(o.id).slice(-8)}`,
    `Operación: ${o.paidReference ?? '-'}`,
  ]);
  addMessage(
    o,
    'merchant',
    {
      text: 'Listo, ya te transferí. Te dejo el comprobante.',
      attachment: {
        name: `comprobante-${String(o.id).slice(-8)}.pdf`,
        contentType: 'application/pdf',
        data,
      },
    },
    t,
  );
}

/** An order's chat as its views carry it. */
export function chatSummary(orderId: string) {
  const list = db()
    .messages.filter((m) => m.orderId === orderId && Date.parse(m.createdAt) <= now())
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const last = list[list.length - 1];
  return { count: list.length, lastAt: last?.createdAt ?? null, lastFrom: last?.from ?? null };
}

/** A token balance on the mock network, moved by `delta` base units (a missing trustline takes
    nothing). */
export function credit(address: string, symbol: string, delta: bigint) {
  const a = db().chain.accounts[address];
  if (!a?.exists) return false;
  const cur = a.trust[symbol];
  if (cur === null || cur === undefined) return false;
  const next = BigInt(cur) + delta;
  if (next < 0n) return false;
  a.trust[symbol] = next.toString();
  return true;
}

/** A sale that ends without a release: its tokens go back to the seller. */
export function refundSeller(o: Wire) {
  if (o._refunded || !o._locked) return;
  o._refunded = true;
  credit(o.sellerAddress, o.tokenSymbol, BigInt(o.tokenAmount));
}

/** A completed order's side effects: the buyer receives the tokens (less the protocol fee), and
    its charge is paid. */
export function onCompleted(o: Wire) {
  if (!o._credited) {
    o._credited = true;
    const fee = (BigInt(o.tokenAmount) * BigInt(o.feeBps ?? 0)) / 10000n;
    credit(o.buyerAddress, o.tokenSymbol, BigInt(o.tokenAmount) - fee);
  }
  if (o.chargeId) {
    const c = db().charges.find((x) => x.id === o.chargeId);
    if (c) {
      c.orders = Number(c.orders ?? 0) + 1;
      if (!c.multiUse) {
        c.status = 'paid';
        c.paidAt = o.updatedAt;
      }
    }
  }
}

export { USER };
