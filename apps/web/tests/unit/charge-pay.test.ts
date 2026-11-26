/* charge-pay.test.ts: paying a charge from the balance is pinned to the token the app pays with,
   the recipient shown and the amount shown (src/lib/app/charge.ts), and the signing check refuses
   a transaction that swaps any of them. */
import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { Keypair, StrKey, hash } from '@stellar/stellar-sdk/base';
import { balancePrice, chargeExpectation } from '@/lib/app/charge';
import { verifyTransaction } from '@/lib/p2p/tx-verify';
import { contractTransfer, envelope, payment } from '@/lib/stellar/build';
import { PASSPHRASES } from '@/lib/stellar/network';
import type { ChargePayment, PayerCharge } from '@/lib/app/types';
import type { P2pToken } from '@/lib/p2p/types';

const enc = (s: string) => new TextEncoder().encode(s);
const account = (seed: string) => Keypair.fromRawEd25519Seed(hash(enc(seed))).publicKey();
const contract = (seed: string) => StrKey.encodeContract(hash(enc(seed)));
const PAYER = account('payer');
const SHOP = account('shop');
const THIEF = account('thief');
const ISSUER = account('issuer');
const USDC: P2pToken = { symbol: 'USDC', code: 'USDC', issuer: ISSUER, contract: contract('usdc'), decimals: 7 };
const TUSD: P2pToken = { symbol: 'TUSD', code: 'TUSD', issuer: ISSUER, contract: contract('tusd'), decimals: 7 };
const NETWORK = {
  id: 'testnet',
  networkPassphrase: PASSPHRASES.testnet,
  contract: contract('market'),
  tokens: [USDC, TUSD],
};
const NOW = 1_800_000_000;

const charge = (over: Partial<NonNullable<PayerCharge['payWithBalance']>> = {}): PayerCharge => ({
  id: 'ch_1',
  status: 'open',
  currency: 'ARS',
  fiatAmount: '25000.00',
  description: null,
  merchantName: 'Tienda Mamoré',
  network: 'testnet',
  token: 'USDC',
  expiresAt: null,
  payWithBalance: {
    token: 'USDC',
    tokenContract: USDC.contract,
    amount: '167900000',
    expiresAt: '2026-11-19T12:01:00Z',
    recipient: SHOP,
    ...over,
  },
});
const pay = (over: Partial<ChargePayment> = {}): ChargePayment => ({
  id: 'chp_1',
  chargeId: 'ch_1',
  network: 'testnet',
  token: 'USDC',
  amount: '167900000',
  hash: null,
  status: 'PENDING',
  expiresAt: null,
  ...over,
});
const tx = (ops: Parameters<typeof envelope>[1]) =>
  envelope(
    { source: PAYER, sequence: '7', networkId: 'testnet', passphrase: PASSPHRASES.testnet, maxTime: NOW + 300 },
    ops,
    'transfer',
  );
const ctx = { network: NETWORK, wallet: PAYER, now: NOW };

describe('the price is only ever in the token the app pays with', () => {
  test('a price in the selected token is offered', () =>
    assert.equal(balancePrice(charge(), USDC)?.amount, '167900000'));
  test('an asset swap makes paying with the balance unavailable', () => {
    assert.equal(balancePrice(charge({ tokenContract: TUSD.contract }), USDC), null, 'another contract');
    assert.equal(balancePrice(charge({ token: 'TUSD' }), USDC), null, 'another symbol');
    assert.equal(balancePrice(charge({ tokenContract: null }), USDC), null, 'no contract stated');
    assert.equal(balancePrice(charge({ tokenContract: SHOP }), USDC), null, 'not a contract');
    assert.equal(balancePrice(charge(), null), null, 'no token selected');
  });
  test('a closed charge, a zero amount or a recipient that is no address is no price', () => {
    assert.equal(balancePrice({ ...charge(), status: 'paid' }, USDC), null);
    assert.equal(balancePrice(charge({ amount: '0' }), USDC), null);
    assert.equal(balancePrice(charge({ recipient: '0xabc' }), USDC), null);
  });
});

describe('the transaction pays the shown amount of the selected token to the shown recipient', () => {
  const c = charge();
  const price = balancePrice(c, USDC)!;
  const expect = chargeExpectation(c, price, USDC, pay())!;
  test('the honest payment passes', () =>
    assert.equal(verifyTransaction(tx([payment(SHOP, USDC, '167900000')]), ctx, expect), null));
  test('refused: a recipient swap', () =>
    assert.equal(verifyTransaction(tx([payment(THIEF, USDC, '167900000')]), ctx, expect), 'args'));
  test('refused: an asset swap in the transaction', () =>
    assert.equal(verifyTransaction(tx([payment(SHOP, TUSD, '167900000')]), ctx, expect), 'args'));
  test('refused: another amount', () =>
    assert.equal(verifyTransaction(tx([payment(SHOP, USDC, '167900001')]), ctx, expect), 'args'));
  test('a contract recipient goes through the token contract, and only that one', () => {
    const shopC = contract('a shop contract');
    const cc = charge({ recipient: shopC });
    const e = chargeExpectation(cc, balancePrice(cc, USDC)!, USDC, pay())!;
    assert.equal(verifyTransaction(tx([contractTransfer(PAYER, shopC, USDC, '167900000')]), ctx, e), null);
    assert.equal(verifyTransaction(tx([contractTransfer(PAYER, shopC, TUSD, '167900000')]), ctx, e), 'target');
  });
  test("refused: the API's payment is for another charge, amount or token", () => {
    assert.equal(chargeExpectation(c, price, USDC, pay({ chargeId: 'ch_2' })), null);
    assert.equal(chargeExpectation(c, price, USDC, pay({ amount: '1' })), null);
    assert.equal(chargeExpectation(c, price, USDC, pay({ token: 'TUSD' })), null);
    assert.equal(chargeExpectation(c, price, USDC, null), null);
  });
});
