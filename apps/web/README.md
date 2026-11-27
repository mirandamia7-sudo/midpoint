# @midpoint/web

The web app on Stellar: the payments app (an installable PWA), the hosted charge page, the
merchant and business dashboard, and the docs. Vite + React 19 + React Router + Tailwind v4,
TypeScript strict, `@stellar/stellar-sdk` 17, wallets from [Pollar](https://docs.pollar.xyz). UI in
Spanish (default), English and Brazilian Portuguese. The product's name lives in `src/lib/brand.ts` only; translations
say `{brand}`.

| Path | What |
| --- | --- |
| `/` | landing |
| `/app` | the payments app: welcome and sign-in, then home (balance, send, receive, add money, withdraw, scan) |
| `/app/handle` | claim or change the `@handle` |
| `/app/scan` | camera (BarcodeDetector, or jsQR loaded on demand), flashlight, paste or pick an image |
| `/app/send?to=&amount=&note=` | send to an `@handle` or address (also what a payment link opens) |
| `/app/receive` | my QR: a payment link, or a SEP-7 request for other Stellar wallets |
| `/app/add`, `/app/withdraw` | buy and sell USDC (the market's BUY and SELL), then `/app/order/{id}` |
| `/app/pay-qr`, `/app/qr/{id}` | pay a shop's QR (Peru's, PIX, Argentina's interoperable QR) through a market merchant |
| `/app/charge/{id}` | pay a business's charge from the balance (or in local money at `/pay/{id}`) |
| `/app/activity`, `/app/activity/{transfer,order}/{id}` | movements, and one with its status timeline |
| `/app/me` | handle, address, network, currency, language, theme, install, recovery, sign out |
| `/pay/{chargeId}` (also `/c/{chargeId}`) | the hosted charge page the API links to (local-money checkout) |
| `/dashboard/*` | overview, liquidity, offers, payment methods, orders, charges, payouts, API keys, webhooks, team |
| `/docs/*` | guides and the API reference (from `apps/api/openapi.json`) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev -w @midpoint/web` | dev server on `PORT` (default 3000), `/v1/*` and `/.well-known/*` proxied to the API |
| `npm run dev:mock -w @midpoint/web` | every screen against the in-browser mock API and the demo wallet, no backend |
| `npm run build -w @midpoint/web` | type check and production build into `dist/` (with `manifest.webmanifest` and `sw.js`) |
| `npm test -w @midpoint/web` | unit tests (Vitest) |
| `npm run test:e2e -w @midpoint/web` | the main flows in Chromium, mock mode, on Pixel 7, iPhone 14 and desktop profiles |
| `npm run lint -w @midpoint/web` | ESLint (relative imports are an error) |
| `npm run gen:api -w @midpoint/web` | regenerate `src/lib/api/openapi.gen.ts` from `apps/api/openapi.json` |
| `npm run icons -w @midpoint/web` | render `public/icons/*.png` from the SVG mark (Playwright's Chromium) |

`@midpoint/contracts` and `@midpoint/payment-qr` must be built first (`npm run build -w ...`): the
signing check decodes contract calls with `MARKET_SPEC`, and every scanned or pasted text is read
by `@midpoint/payment-qr`.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | dev server port |
| `MIDPOINT_API_URL`, `API_URL`, `VITE_API_URL`, `PUBLIC_API_URL` | `http://localhost:4000` | the API the dev server proxies `/v1/*` and `/.well-known/*` to (first one set) |
| `VITE_APP_TIER` | `live` | the app's tier (the API's `APP_TIER`); a dev server falls back to `test` when `live` has no market. Pollar's network follows it: `testnet` for test, `mainnet` for live |
| `VITE_POLLAR_PUBLISHABLE_KEY` | empty | the Pollar app's publishable key. Empty: no Pollar (mock mode, or the dev-key wallet) |
| `VITE_SEP10_HOME_DOMAIN` | this page's host | the home domain a sign-in challenge must name (the API's `SEP10_HOME_DOMAIN`) |
| `VITE_SEP10_WEB_AUTH_DOMAIN` | the home domain | the `web_auth_domain` a sign-in challenge must name |
| `VITE_API_BASE_URL` | empty | production: the API's origin when it is not the web app's own (`/.well-known/stellar.toml` is still read from this origin) |
| `MIDPOINT_OPENAPI_PATH` | `../api/openapi.json` | the spec the docs reference and `gen:api` read |

## Wallets and sign-in

A `StellarWallet` (`src/lib/wallet/types.ts`) is one of:

- **`pollar`**: email code or Google through Pollar (the app's own screens), and, in the
  dashboard, Freighter or Albedo through Pollar's built-in adapters. Pollar loads as its own chunk,
  only with `VITE_POLLAR_PUBLISHABLE_KEY`. Transactions are signed with
  `signTx(xdr, { skipSponsorship: true })` (our API pays fees, not Pollar); challenges with
  `stellar.sep10.sign` and this app's configured domains. A passkey smart wallet (a C address)
  cannot sign SEP-10 or classic transactions and is refused.
- **`demo`** (mock mode only): a key derived from a fixed public seed per demo persona (a person,
  Norte Cambios, Tienda Mamoré, a new wallet). The sign-in screens look as in production: any
  email and any 6-digit code; `<persona>@demo.test` picks the persona (`personaForEmail`).
- **`dev-key`** (development builds only): one of the dev stack's printed test secret keys, signed
  in this tab, to use a local or testnet stack without Pollar. Shown under the sign-in form only
  with `?dev` in the URL or when the build has no Pollar key. Kept in this tab's sessionStorage so
  a reload keeps the session; never a real key.

Mock mode, the demo wallet and the dev key are guarded at compile time: a production build holds
none of them, not even as a lazy chunk.

**Sign-in** is SEP-10 as soon as a wallet is ready: `GET /v1/auth/challenge?account=G...`, then
`POST /v1/auth/verify { transaction }`; the session is the API's HttpOnly cookie.

## The Pollar app the owner must set up

Use a Pollar app created for this product, never another company's app.

1. Create the app in the Pollar dashboard and copy its **publishable key** into
   `VITE_POLLAR_PUBLISHABLE_KEY` (one app per tier is simplest: a testnet app for test builds, a
   mainnet app for live builds).
2. **Allowed origins**: `http://localhost:3000` (development) and every production origin of the
   web app.
3. **Login methods**: email (OTP) and Google; external wallets (Freighter, Albedo) for the
   dashboard. Custody: Pollar's wallet service in test, Turnkey (co-signed or self-custody) in
   live.
4. **Signing rules**: allowlist only the market contract (`P2P_<NET>_CONTRACT`) and its functions
   a person signs (`open_with_deposit`, `accept`, `mark_paid`, `release`, `cancel`, `dispute`,
   `deposit`, `withdraw`, `set_matcher`, `set_operator`), the USDC (and dev TUSD) Stellar Asset
   Contracts' `transfer`, classic `payment` and `change_trust` of those assets, and SEP-10
   challenges for this app's home domain.
5. **Signature confirmation policy**: ask the person to confirm every transaction (Pollar's
   `prompt` confirmation), and turn off Pollar's own fee sponsorship for this app (the API
   fee-bumps).

## Security model in the browser

- The session is the API's HttpOnly cookie after SEP-10; the page never reads or stores a token.
  A new API key or webhook secret is shown once and never kept.
- **Before a wallet signs a sign-in challenge** (`src/lib/stellar/challenge.ts`): its source is the
  `SIGNING_KEY` of this origin's `/.well-known/stellar.toml` with a valid signature by it, its
  sequence is 0 (it can never be submitted), it holds only `manage_data`, its first operation is
  the wallet's `<home domain> auth` with this app's configured home domain, its `web_auth_domain`
  is this app's, and it expires within minutes. Anything else is refused unsigned: an API answer
  cannot relay another service's challenge.
- **Before a wallet signs a transaction** (`src/lib/p2p/tx-verify.ts`): the envelope is not a
  fee-bump, hashes to the stated hash under the market's passphrase, is unsigned, has the wallet
  as source, exactly one operation (the sponsored activation is the only exception, with its exact
  shape), time bounds at most ten minutes ahead and a capped fee. A contract call is decoded
  against `MARKET_SPEC` and every argument is pinned to what the person saw or the market
  publishes (a sale's seller, buyer, token, amount, bond, windows, integrator and fee, and a ref
  derived from the order's uuid); its only authorization is the source account's, whose root is
  the call itself and whose only sub-invocation is the exact token pull to the market. A payment's
  destination, asset, amount and memo are the reviewed ones. A missing expectation is a refusal.
- **After the wallet signs**, the signed envelope must be that same transaction
  (`src/lib/wallet/signed.ts`); only then is it handed to `POST /v1/app/submit` (or
  `/v1/p2p/submit`), which fee-bumps it from the sponsor.
- Scanned and pasted text goes through `@midpoint/payment-qr` only. A secret key is never kept; a
  SEP-7 `tx` request, another asset or network, or a non-text memo is refused; only this app's own
  links are followed.

## The installable app

`/manifest.webmanifest` (name from `src/lib/brand.ts`, `start_url` `/app`, standalone) and
`/sw.js` (`pwa/sw.js`, versioned per build) are generated by the Vite config. The worker caches
the shell and the hashed assets, never `/v1` or `/.well-known`, falls back to the cached shell (or
a small offline page) without a connection, and waits for the app's update prompt. Android's
install prompt and an iOS "Add to Home Screen" hint show on the home screen and in the profile.
The worker registers in production builds only.
