/* checkout.test.ts: the hosted charge page's trust boundary (src/lib/p2p/checkout.ts) and the
   explorer links every screen shows (src/lib/stellar/network.ts). The page tells people where to
   send money: a malformed answer is an error, never half-shown, and a link goes only to the
   network's https explorer, for a real Stellar hash, account or contract. */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  parseAccount,
  parseCheckoutCharge,
  parseCheckoutOrder,
  parseCreatedOrder,
} from '@/lib/p2p/checkout';
import { addressKind, explorerLink } from '@/lib/stellar/network';

/* The checkout routes' charge and order, as the API answers them. */
const CHARGE = {
  id: 'cm3p2pchg0001l70g8v5q3z2w',
  network: 'testnet',
  tokenSymbol: 'USDC',
  currency: 'ARS',
  fiatAmount: '85000.00',
  description: 'Order #1042',
  merchantName: 'Tienda Mamoré',
  status: 'open',
  rails: ['ar_bank_transfer'],
  expiresAt: '2026-11-26T12:00:00.000Z',
};
const ORDER = {
  id: '5f0c2a9e-1b3d-4e5f-8a7b-9c0d1e2f3a4b',
  chargeId: CHARGE.id,
  status: 'awaiting_payment',
  currency: 'ARS',
  fiatAmount: '85000.00',
  rail: 'ar_bank_transfer',
  merchantName: 'Lumio Exchange',
  paymentDeadline: '2026-11-19T12:30:00.000Z',
  paymentDetails: {
    rail: 'ar_bank_transfer',
    holderName: 'Lumio Exchange SRL',
    details: { alias: 'lumio.pagos.ars', cuit: '30714209879' },
  },
  paidAt: null,
  createdAt: '2026-11-19T12:00:00.000Z',
};

test('a charge: every field checked, the symbol from tokenSymbol, rails possibly none', () => {
  assert.deepEqual(parseCheckoutCharge(CHARGE), {
    id: CHARGE.id,
    network: 'testnet',
    token: 'USDC',
    currency: 'ARS',
    fiatAmount: '85000.00',
    description: 'Order #1042',
    payeeName: 'Tienda Mamoré',
    status: 'open',
    rails: ['ar_bank_transfer'],
    expiresAt: CHARGE.expiresAt,
  });
  assert.equal(
    parseCheckoutCharge({ ...CHARGE, merchantName: undefined })?.payeeName,
    null,
    "the payee is the charge creator's name, when given",
  );
  assert.equal(
    parseCheckoutCharge({ ...CHARGE, merchantName: 'x'.repeat(61) }),
    null,
    '60 characters at most',
  );
  assert.deepEqual(
    parseCheckoutCharge({ ...CHARGE, rails: [] })?.rails,
    [],
    'no merchant takes it right now',
  );
  assert.equal(parseCheckoutCharge({ ...CHARGE, description: null })?.description, null);
  for (const bad of [
    { ...CHARGE, status: 'PENDING' },
    { ...CHARGE, currency: 'ars' },
    { ...CHARGE, fiatAmount: '1e5' },
    { ...CHARGE, fiatAmount: '1.234' },
    { ...CHARGE, rails: ['<x>'] },
    { ...CHARGE, rails: 'ar_bank_transfer' },
    { ...CHARGE, description: 'a\u0000b' },
    { ...CHARGE, expiresAt: 'soon' },
    { ...CHARGE, id: '../x' },
    { ...CHARGE, network: 'Base Main' },
    { ...CHARGE, tokenSymbol: undefined },
    null,
    [],
  ])
    assert.equal(parseCheckoutCharge(bad), null, JSON.stringify(bad));
});

test("the payer's order and the account to pay into: plain short strings under plain keys", () => {
  const o = parseCheckoutOrder(ORDER);
  assert.ok(o);
  assert.equal(o!.payBy, ORDER.paymentDeadline);
  assert.equal(o!.paymentDetails?.details.alias, 'lumio.pagos.ars');
  assert.equal(o!.paymentDetails?.document, null);
  assert.equal(o!.merchantName, 'Lumio Exchange');
  assert.equal(
    parseCheckoutOrder({ ...ORDER, paymentDetails: null })?.paymentDetails,
    null,
    'an order that ended shows no account',
  );
  for (const bad of [
    { ...ORDER, status: 'PAID' },
    { ...ORDER, paymentDetails: { ...ORDER.paymentDetails, details: { '<b>': 'x' } } },
    { ...ORDER, paymentDetails: { ...ORDER.paymentDetails, details: { alias: 'a\nb' } } },
    { ...ORDER, paymentDetails: { rail: 'x' } },
    { ...ORDER, paymentDeadline: 'tomorrow' },
    { ...ORDER, fiatAmount: 85000 },
    { ...ORDER, chargeId: '../x' },
  ])
    assert.equal(parseCheckoutOrder(bad), null, JSON.stringify(bad));
  assert.equal(
    parseAccount({ rail: 'br_pix', holderName: 'João', details: {} }),
    null,
    'an account has details',
  );
  // Opening it answers the order's own fields with the token beside them.
  const created = parseCreatedOrder({
    ...ORDER,
    payerToken: 'q3Jx8b2mNfV0tq9Lr5sD1uYc7wHk4eAa6zPgT0oXiEM',
  });
  assert.equal(created?.order.id, ORDER.id);
  assert.equal(created?.payerToken, 'q3Jx8b2mNfV0tq9Lr5sD1uYc7wHk4eAa6zPgT0oXiEM');
  assert.equal(parseCreatedOrder({ ...ORDER, payerToken: 'short' }), null);
  assert.equal(
    parseCreatedOrder({ order: ORDER, payerToken: 'q3Jx8b2mNfV0tq9Lr5sD1uYc7wHk4eAa6zPgT0oXiEM' }),
    null,
    'the answer is flat',
  );
});

const NETWORK = {
  explorerUrl: 'https://stellar.expert/explorer/testnet',
};
const HASH = 'a'.repeat(64);
const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

test('explorer links: https only, and only for a real hash, account or contract', () => {
  assert.equal(
    explorerLink(NETWORK, 'tx', HASH),
    `https://stellar.expert/explorer/testnet/tx/${HASH}`,
  );
  assert.equal(
    explorerLink({ explorerUrl: 'https://stellar.expert/explorer/testnet/' }, 'account', ACCOUNT),
    `https://stellar.expert/explorer/testnet/account/${ACCOUNT}`,
    'a trailing slash is not doubled',
  );
  assert.equal(
    explorerLink(NETWORK, 'contract', CONTRACT),
    `https://stellar.expert/explorer/testnet/contract/${CONTRACT}`,
  );
  assert.equal(explorerLink(NETWORK, 'tx', `0x${HASH}`), null, 'an EVM hash is not one');
  assert.equal(explorerLink(NETWORK, 'tx', 'abc'), null);
  assert.equal(explorerLink(NETWORK, 'contract', ACCOUNT), null, 'an account is no contract');
  assert.equal(explorerLink(NETWORK, 'account', ACCOUNT.toLowerCase()), null, 'StrKeys keep case');
  assert.equal(explorerLink({ explorerUrl: 'javascript:alert(1)' }, 'tx', HASH), null);
  assert.equal(explorerLink({ explorerUrl: 'http://stellar.expert' }, 'tx', HASH), null);
  assert.equal(explorerLink({ explorerUrl: null }, 'tx', HASH), null);
  assert.equal(explorerLink(null, 'tx', HASH), null);
  assert.equal(addressKind(CONTRACT), 'contract');
  assert.equal(addressKind(ACCOUNT), 'account');
});

test('the payee may come as payeeName; ids may use underscores', () => {
  assert.equal(
    parseCheckoutCharge({ ...CHARGE, merchantName: undefined, payeeName: 'Tienda Mamoré' })
      ?.payeeName,
    'Tienda Mamoré',
  );
  assert.equal(parseCheckoutCharge({ ...CHARGE, id: 'ch_pedido1042' })?.id, 'ch_pedido1042');
});
