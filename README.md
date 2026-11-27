# Midpoint

Midpoint is a Bolivian payments app for sending money and paying across Latin America. People add
money in bolivianos (or their own local currency), keep a balance in dollars (USDC on Stellar) and
send or pay it as local money in another country: a shop's QR in Peru, a PIX key in Brazil, a bank
account in Argentina or Chile. Every exchange is a peer-to-peer order with a local merchant, protected by a Soroban
smart contract.

**Test market:** https://web-production-dee4269a.up.railway.app (Stellar testnet, test money only).

## What it does

For people, the app at `/app` (an installable PWA, in Spanish, English and Portuguese):

- Sign up with an email code or Google (Pollar wallets). Midpoint pays the Stellar network fees.
- Add money and cash out by bank transfer in bolivianos, or in soles, reais (PIX), and Argentine,
  Chilean, Colombian and Mexican pesos.
- Send dollars to anyone by `@handle`, link or QR.
- Pay a shop's QR in another country: Peru's QR (Yape, Plin and the banks), Brazil's PIX and
  Argentina's interoperable QR.
- Send money to a bank account in Bolivia or abroad, such as a CCI in Peru, a PIX key in Brazil or a
  CBU, CVU or alias in Argentina.
- Pay a business's charge from its QR or link.
- Chat with the merchant on each order and get the transfer receipt.

For merchants and businesses, the dashboard and the public API:

- Merchants keep their dollars in the contract, publish offers per currency and payment method, and
  automate accepting, paying and releasing with API keys, webhooks and delegated bot keys. The SDK
  ships a reference merchant bot.
- Businesses embed buying and selling, collect payments in local money (charges) and send payouts.

## How an order works

1. The person types an amount. The matcher picks a merchant whose offer fits and opens the order on
   the contract; there is no order book to browse.
2. The contract locks the order's dollars: the merchant's when the person buys, the person's when
   they sell, pay a QR or send to a bank account.
3. The local money moves off chain (bank transfer, PIX, QR) and the payer marks the order paid,
   with a receipt on the order's chat.
4. The party that received the local money releases the dollars. Deadlines refund automatically,
   and a dispute goes to an arbiter that can only split the order between its own buyer and seller.

Prices follow live market references, and the person sees the quote before confirming.

## Workspaces

| Path                  | What                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`  | The Soroban `P2PMarket` contract (Rust), its committed wasm and interface spec, and its tests                                      |
| `packages/payment-qr` | Reads what the app scans or pastes: Stellar addresses, SEP-7, the app's payment and charge links, handles, EMVCo merchant QRs      |
| `apps/api`            | The public API (NestJS, Prisma, Postgres): offers, matching, orders, charges, payouts, webhooks, sponsored submission, the indexer |
| `apps/web`            | The payments app (`/app`), the merchant dashboard, the charge page, the API docs and the landing (Vite, React, Tailwind)           |
| `packages/sdk`        | TypeScript client for the API, webhook verification and a reference merchant bot                                                   |

The API's OpenAPI spec is [`apps/api/openapi.json`](apps/api/openapi.json); the web serves the docs
at `/docs`.

## Run it locally

Requires Node 24.9 or later.

```sh
npm install
npm run dev:stack -- --testnet      # build, then bring the whole market up on Stellar testnet
npm run dev:stack -- --stop         # stop it (or Ctrl+C in its own terminal)
npm run dev:stack -- --reset        # a fresh database and a fresh market
npm run dev:mock -w @midpoint/web   # only the web, with an in-browser mock API
```

`dev:stack` starts Postgres (Docker when a daemon is already running, otherwise an embedded one),
deploys a market of its own (on testnet the accounts are funded by friendbot; without `--testnet`
it uses a local Stellar network when Docker is running), seeds it through the API and runs three
automated merchants that price from live references. The API is on
http://localhost:4100 and the web on http://localhost:3100 (`--api-port`, `--web-port` and
`--pg-port` change them). The state lives in `.dev-stack/` and survives restarts.

Signing in needs a Pollar app: put its key in `apps/web/.env.local` as
`VITE_POLLAR_PUBLISHABLE_KEY` and allow the web's origin in Pollar's dashboard (see
[`apps/web/README.md`](apps/web/README.md)). The mock web signs in with any email and code.

## Hosted test market

A temporary deployment on Railway with its own testnet market, merchants and database:
[`deploy/railway/README.md`](deploy/railway/README.md) (`npm run hosted -- init --origin https://…`,
then `npm run hosted -- seed`).

## Checks

```sh
npm run build
npm run typecheck
npm run lint
npm test                            # every workspace
npm run test:e2e -w @midpoint/web   # the web in a browser (Playwright)
```

The contract's tests run `cargo test`, so `npm test` needs Rust; `rust-toolchain.toml` pins the
version and the `wasm32v1-none` target. Building does not need Rust: the wasm is committed.

## Status

A prototype running on Stellar testnet. The contract has not been audited, and some decisions are
still open (the protocol fee, multisig owner and arbiter, legal review): see
[`docs/HANDOFF.md`](docs/HANDOFF.md).

## Docs

- [`docs/HANDOFF.md`](docs/HANDOFF.md): the project's state, design, security invariants, open
  decisions and backlog.
- [`docs/STELLAR.md`](docs/STELLAR.md): the design contract of the Stellar market and the app.
- [`AGENTS.md`](AGENTS.md): conventions for contributors.
- The workspace READMEs: [contracts](packages/contracts/README.md), [API](apps/api/README.md),
  [web](apps/web/README.md), [SDK](packages/sdk/README.md).
