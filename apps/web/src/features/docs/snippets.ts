/* snippets.ts: the docs' code samples, shared by every language (code is not translated; its
   comments are in English like all code). A catalog block '@@code <name>' places one. Addresses
   in them are placeholders (G... for accounts, C... for contracts); amounts are base units of a
   7-decimal Stellar asset. */

export interface Snippet {
  lang: 'bash' | 'ts' | 'json' | 'csv';
  code: string;
}

const env = `export API="$MIDPOINT_API_URL/v1/p2p"
export AUTH="Authorization: Bearer $MIDPOINT_API_KEY"   # pk_test_... or pk_live_...`;

export const SNIPPETS: Record<string, Snippet> = {
  env: { lang: 'bash', code: env },

  market: {
    lang: 'bash',
    code: `curl "$MIDPOINT_API_URL/v1/market?tier=test"
# -> { "available": true, "tier": "test",
#      "networks": [ { "id": "testnet", "name": "Stellar Testnet",
#        "networkPassphrase": "Test SDF Network ; September 2015",
#        "rpcUrl": "https://soroban-testnet.stellar.org", "horizonUrl": "https://horizon-testnet.stellar.org",
#        "explorerUrl": "https://stellar.expert/explorer/testnet",
#        "contract": "C...", "protocolFeeBps": 30, "paused": false,
#        "tokens": [ { "symbol": "USDC", "code": "USDC", "issuer": "G...", "contract": "C...", "decimals": 7 } ] } ],
#      "currencies": [ { "code": "BOB", "decimals": 2,
#        "rails": [ { "id": "bo_bank_transfer", "fields": [...] } ] }, ... ],
#      "bondBps": 1000, "maxIntegratorFeeBps": 500, "matcher": "G...", "sponsor": { "enabled": true },
#      "windows": { "buyPaymentWindow": 1800, "sellAcceptWindow": 300,
#                   "sellPaymentWindow": 1800, "sellSettleWindow": 21600 } }`,
  },

  signIn: {
    lang: 'ts',
    code: `import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

// SEP-10: the API answers a challenge transaction for the account; the wallet signs it (it can
// never be submitted: its sequence number is 0) and the API answers a session.
const account = keypair.publicKey(); // G...
const { transaction, network_passphrase } = await (
  await fetch(\`\${BASE}/v1/auth/challenge?account=\${account}\`)
).json();

// Check it before signing: only manage_data operations, the first one "<home domain> auth"
// for this account, signed by the SIGNING_KEY of the site's /.well-known/stellar.toml.
const tx = TransactionBuilder.fromXDR(transaction, network_passphrase);
tx.sign(keypair);

const { token } = await (
  await fetch(\`\${BASE}/v1/auth/verify\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  })
).json(); // token: "ps_sess_..." (a browser gets an HttpOnly cookie instead)`,
  },

  registerWallet: {
    lang: 'bash',
    code: `curl -X POST $API/accounts/challenge -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "address": "GYOURWALLET..." }'
# -> { "transaction": "AAAAAgAAAA...", "networkPassphrase": "Test SDF Network ; September 2015",
#      "expiresAt": "..." }
# A SEP-10-shaped challenge bound to your organization: sign it with the wallet (never submit it).

curl -X POST $API/accounts -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "address": "GYOURWALLET...", "transaction": "AAAAAgAAAA...(signed)",
        "label": "Treasury", "displayName": "Norte Cambios" }'`,
  },

  merchantProfile: {
    lang: 'bash',
    code: `curl -X PATCH $API/accounts/ACCOUNT_ID -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "displayName": "Norte Cambios", "merchantStatus": "PAUSED" }'`,
  },

  deposit: {
    lang: 'bash',
    code: `curl -X POST $API/transactions -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "network": "testnet", "from": "ACCOUNT_ID", "action": "deposit",
        "args": { "token": "USDC", "amount": "50000000000" } }'
# -> { "network": "testnet", "action": "deposit", "description": "...",
#      "xdr": "AAAAAgAAAA...", "hash": "9f2c...", "expiresAt": "..." }

# Decode and check the XDR, sign it with the wallet, then hand it back (see "Submit").`,
  },

  submit: {
    lang: 'ts',
    code: `import { TransactionBuilder } from '@stellar/stellar-sdk';

// The API built an unsigned, prepared envelope; the wallet signs it and the API submits it,
// wrapped in a fee-bump from its sponsor account: the wallet never needs XLM for fees.
const tx = TransactionBuilder.fromXDR(built.xdr, networkPassphrase);
// ...check tx: source, one operation, the market contract, the function and every argument...
tx.sign(walletKeypair);

let r = await (
  await fetch(\`\${API}/submit\`, { method: 'POST', headers, body: JSON.stringify({ xdr: tx.toXDR() }) })
).json(); // { hash, status: "PENDING" | "SUCCESS" | "FAILED", error }
while (r.status === 'PENDING') {
  await new Promise((ok) => setTimeout(ok, 1500));
  r = await (await fetch(\`\${API}/submissions/\${r.hash}\`, { headers })).json();
}`,
  },

  setMatcher: {
    lang: 'bash',
    code: `curl -X POST $API/transactions -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "network": "testnet", "from": "ACCOUNT_ID", "action": "set_matcher",
        "args": { "maxPerOrder": "10000000000", "autoSettle": false } }'`,
  },

  paymentMethod: {
    lang: 'bash',
    code: `curl -X POST $API/payment-methods -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{
    "accountId": "ACCOUNT_ID",
    "rail": "bo_bank_transfer",
    "holderName": "Norte Cambios SRL",
    "details": { "bank": "Banco Unión", "accountType": "checking", "accountNumber": "1000023456789",
                 "documentType": "NIT", "documentNumber": "1020304025" },
    "label": "Main account"
  }'`,
  },

  offer: {
    lang: 'bash',
    code: `curl -X POST $API/offers -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{
    "accountId": "ACCOUNT_ID",
    "side": "SELL_TOKEN",
    "network": "testnet",
    "token": "USDC",
    "currency": "BOB",
    "rails": ["bo_bank_transfer"],
    "price": "12.05",
    "priceTtlSeconds": 600,
    "minFiat": "70",
    "maxFiat": "14000",
    "active": true
  }'`,
  },

  qrOffer: {
    lang: 'bash',
    code: `# Pay shops' QRs for people (QR_PAY): a BUY_TOKEN offer on the QR rails.
curl -X POST $API/offers -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "accountId": "ACCOUNT_ID", "side": "BUY_TOKEN", "network": "testnet", "token": "USDC",
        "currency": "PEN", "rails": ["pe_qr"], "price": "3.70", "priceTtlSeconds": 600,
        "minFiat": "5", "maxFiat": "2000", "active": true }'`,
  },

  release: {
    lang: 'bash',
    code: `curl -X POST $API/transactions -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "network": "testnet", "from": "ACCOUNT_ID", "action": "release",
        "args": { "orderId": "ORDER_ID" } }'
# Then sign the XDR with the wallet and POST it to $API/submit.`,
  },

  setOperator: {
    lang: 'bash',
    code: `curl -X POST $API/transactions -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "network": "testnet", "from": "ACCOUNT_ID", "action": "set_operator",
        "args": { "operator": "GBOTWALLET...", "permissions": 6 } }'`,
  },

  botMatches: {
    lang: 'ts',
    code: `import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

const API = \`\${process.env.MIDPOINT_API_URL}/v1/p2p\`;
const headers = {
  Authorization: \`Bearer \${process.env.MIDPOINT_API_KEY}\`,
  'Content-Type': 'application/json',
};
const bot = Keypair.fromSecret(process.env.BOT_SECRET!); // the bot's own key, never the merchant's

interface BankTransfer {
  currency: string; // ISO 4217, e.g. "BOB"
  amount: string; // local money as received, e.g. "1200.00"
  payerName?: string; // the sender's name, as the bank reports it
  payerDocument?: string; // the sender's tax id, when the bank reports it
  reference?: string; // the bank's transfer id
}

// Called by your bank integration for every incoming transfer.
export async function onBankTransfer(transfer: BankTransfer, networkPassphrase: string) {
  const res = await fetch(\`\${API}/merchant/transfer-matches\`, {
    method: 'POST',
    headers,
    body: JSON.stringify(transfer),
  });
  if (!res.ok) throw new Error(\`transfer-matches failed with \${res.status}\`);
  const { data } = await res.json();

  const best = data[0];
  // Release on its own only when amount, name and document all match; leave the rest to a person.
  if (!best || best.score < 3) return;

  // The release is a Stellar transaction; the bot's key signs it (its release permission lets it
  // release the merchant's order) and the API submits it.
  const tx = TransactionBuilder.fromXDR(best.transaction.xdr, networkPassphrase);
  tx.sign(bot);
  await fetch(\`\${API}/submit\`, { method: 'POST', headers, body: JSON.stringify({ xdr: tx.toXDR() }) });
  console.log(\`released order \${best.order.id} (\${best.matchedOn.join(', ')})\`);
}`,
  },

  botPrice: {
    lang: 'ts',
    code: `await fetch(\`\${API}/offers/\${offerId}\`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ price: '12.05' }),
});`,
  },

  buy: {
    lang: 'bash',
    code: `curl -X POST $API/quotes -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "side": "BUY", "network": "testnet", "token": "USDC", "currency": "BOB",
        "rail": "bo_bank_transfer", "fiatAmount": "350" }'

curl -X POST $API/orders -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{
    "kind": "BUY",
    "quoteId": "QUOTE_ID",
    "recipient": "GUSERWALLET...",
    "payer": { "name": "Ana Flores", "document": "6543210" },
    "externalReference": "order-881"
  }'
# -> { "id": "...", "status": "pending", "paymentDetails": { ... }, "paymentDeadline": "..." }`,
  },

  buyPaid: {
    lang: 'bash',
    code: `curl -X POST $API/orders/ORDER_ID/paid -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "reference": "TRX-88421" }'`,
  },

  sell: {
    lang: 'bash',
    code: `curl -X POST $API/quotes -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{ "side": "SELL", "network": "testnet", "token": "USDC", "currency": "BOB",
        "rail": "bo_bank_transfer", "tokenAmount": "250000000" }'

curl -X POST $API/orders -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{
    "kind": "SELL",
    "quoteId": "QUOTE_ID",
    "seller": "GUSERWALLET...",
    "beneficiary": { "holderName": "Ana Flores",
                     "details": { "bank": "Banco Unión", "accountType": "savings",
                                  "accountNumber": "1000023456781" } }
  }'
# -> { "id": "...", "status": "pending",
#      "transactions": [ { "action": "open_with_deposit", "xdr": "AAAAAgAAAA...", "hash": "...", ... } ] }`,
  },

  qrPay: {
    lang: 'bash',
    code: `# The person scanned a shop's QR (EMV payload, CRC checked). Session routes: the app's own.
curl -X POST "$MIDPOINT_API_URL/v1/app/quotes" -b session.txt -H "Content-Type: application/json" \\
  -d '{ "kind": "QR_PAY", "network": "testnet", "token": "USDC",
        "qr": "0002010102123944...6304ABCD", "fiatAmount": "45.00" }'

curl -X POST "$MIDPOINT_API_URL/v1/app/orders" -b session.txt -H "Content-Type: application/json" \\
  -d '{ "kind": "QR_PAY", "quoteId": "QUOTE_ID", "qr": "0002010102123944...6304ABCD" }'
# -> the order and its unsigned open_with_deposit: accept 2 min, payment 10 min, settle 1 h.`,
  },

  appTransfer: {
    lang: 'bash',
    code: `curl -X POST "$MIDPOINT_API_URL/v1/app/transfers" -b session.txt -H "Content-Type: application/json" \\
  -d '{ "network": "testnet", "to": "@lucia", "token": "USDC", "amount": "125000000",
        "note": "Almuerzo" }'
# -> { "transfer": { "id": "...", "to": "G...", "toHandle": "lucia", "status": "PENDING", ... },
#      "transaction": { "xdr": "AAAAAgAAAA...", ... } }   # a payment; sign it, then POST /v1/app/submit`,
  },

  charge: {
    lang: 'bash',
    code: `curl -X POST $API/charges -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{
    "currency": "BOB",
    "fiatAmount": "250",
    "network": "testnet",
    "token": "USDC",
    "recipient": "ACCOUNT_ID",
    "description": "Order #1042",
    "payeeName": "Tienda Mamoré",
    "expiresAt": "2026-12-01T00:00:00Z",
    "multiUse": false
  }'
# -> { "id": "ch_...", "url": "https://<web>/pay/ch_...", "status": "open", ... }`,
  },

  checkout: {
    lang: 'bash',
    code: `# No API key: these are the payer's routes.
curl "$MIDPOINT_API_URL/v1/p2p-checkout/charges/CHARGE_ID"

curl -X POST "$MIDPOINT_API_URL/v1/p2p-checkout/charges/CHARGE_ID/orders" \\
  -H "Content-Type: application/json" \\
  -d '{ "rail": "bo_bank_transfer",
        "payer": { "name": "Ana Flores", "document": "6543210", "email": "ana@example.com" } }'
# -> { "id": "...", "status": "pending", "payerToken": "..." }

curl "$MIDPOINT_API_URL/v1/p2p-checkout/orders/ORDER_ID" -H "X-Payer-Token: PAYER_TOKEN"`,
  },

  payouts: {
    lang: 'bash',
    code: `curl -X POST $API/payouts -H "$AUTH" -H "Content-Type: application/json" \\
  -d '{
    "network": "testnet",
    "token": "USDC",
    "accountId": "ACCOUNT_ID",
    "items": [
      {
        "currency": "BOB",
        "fiatAmount": "1500",
        "rail": "bo_bank_transfer",
        "beneficiary": {
          "holderName": "Ana Flores",
          "details": { "bank": "Banco Unión", "accountType": "savings", "accountNumber": "1000023456781" }
        },
        "externalReference": "payroll-2026-11-ana"
      }
    ]
  }'`,
  },

  payoutsCsv: {
    lang: 'csv',
    code: `currency,amount,rail,holderName,document,bank,accountType,accountNumber,cci,keyType,key,reference
BOB,1500,bo_bank_transfer,Ana Flores,,Banco Unión,savings,1000023456781,,,,inv-1001
PEN,450,pe_bank_transfer,Rosa Quispe,,,,,00219300123456789012,,,inv-1002
BRL,820.50,br_pix,João Silva,52998224725,,,,,email,joao@example.com,inv-1003`,
  },

  apiKey: {
    lang: 'bash',
    code: `# A test key trades on Stellar testnet, a live key on mainnet.
curl "$MIDPOINT_API_URL/v1/p2p/orders" -H "Authorization: Bearer pk_test_..."`,
  },

  webhookPayload: {
    lang: 'json',
    code: `{
  "id": "evt_01JD6Q...",
  "type": "P2P_ORDER_PAID",
  "createdAt": "2026-11-19T14:02:11.000Z",
  "data": {
    "role": "merchant",
    "id": "ord_...",
    "kind": "BUY",
    "status": "paid",
    "network": "testnet",
    "token": "C...",
    "tokenSymbol": "USDC",
    "tokenDecimals": 7,
    "currency": "BOB",
    "rail": "bo_bank_transfer",
    "fiatAmount": "1200.00",
    "tokenAmount": "995850622",
    "paymentDeadline": "2026-11-19T14:30:02.000Z",
    "paidReference": "TRX-88421"
  }
}`,
  },

  webhookVerify: {
    lang: 'ts',
    code: `import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

/** True when the midpoint-signature header was made with your endpoint's secret over this exact
    raw body, less than five minutes ago. Call it before parsing the JSON. */
export function verifyMidpointSignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(parts.v1 ?? '')) return false;
  if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest();
  const received = Buffer.from(parts.v1, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Express: keep the raw body for this route.
// app.post('/hooks/midpoint', express.raw({ type: 'application/json' }), (req, res) => {
//   const ok = verifyMidpointSignature(req.body.toString('utf8'), req.header('midpoint-signature'), SECRET);
//   if (!ok) return res.sendStatus(400);
//   const event = JSON.parse(req.body.toString('utf8'));
//   // Process event.id once; read the order from the API before moving money.
//   res.sendStatus(204);
// });`,
  },
};
