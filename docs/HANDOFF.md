# Midpoint: handoff

The state of the project and everything a new session needs to continue it. Last updated at the
end of 2026-11-19, after the move to Stellar and the mobile payments app. Read this first, then
[`AGENTS.md`](../AGENTS.md) (binding conventions), [`docs/STELLAR.md`](STELLAR.md) (the design
contract of the Stellar port and the app) and the workspace READMEs.

## 1. What Midpoint is

A **Bolivian** peer-to-peer market for stablecoins (USDC) against local money (bank transfers in
bolivianos first, then Bolivia's neighbours: Peru's QR and banks, PIX, Argentina's and Chile's
banks...), modelled on p2p.me but with a **public API**, running on **Stellar**. On top of the
market sits a **simple payments app** (an installable PWA at `/app`): balance in dollars, send and
receive by `@handle`, link or QR, pay a shop's QR abroad (soles, reais, pesos) through a market
merchant, pay a business's charge, add money and withdraw.

**The product is Bolivian (owner, 2026-11-25: "hazlo un producto boliviano").** Copy, examples,
demo data and the API reference speak of Bolivia first: the footer says «Hecho en Bolivia», the
mock's merchant, charges, orders and payouts are in BOB with Bolivian banks, names and CI/NIT, the
demo QRs are shops a Bolivian pays abroad (a café in Cusco, PIX in Corumbá), and lists of countries
go Bolivia, Peru, Brazil, Argentina, Chile, Colombia, Mexico. Argentina is one more supported
country, never the default or the first example; nothing in the product is from Salta. "Add money"
from a QR that the balance cannot cover is filled in the person's own money, not the shop's.

The owner's requests (Spanish), in order:

> "necesito que me hagas una app de p2p estilo p2p.me pero con api publica, crea el smart contract
> para el escrow y herramientas de pagos automatizadas para nuestros clientes"

> "necesito que hagas su modo de app para movil, piensa que no debe ser solo una plataforma sino
> una app para pagos sencilla" / "pero no debe ser evm, sino en stellar" / "usa pollar"

Owner decisions so far:

| Topic                 | Decision                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Product               | Independent project named **Midpoint** (renamed from "pedospe" on 2026-11-20; not part of any other company's product)                          |
| Chain                 | **Stellar** (Soroban contract `P2PMarket`), replacing the first EVM build entirely                                                              |
| User wallets          | **Pollar** (`@pollar/react` / `@pollar/core` 0.12): email or Google login gives a classic G account                                             |
| Fees                  | **Gasless**: the API fee-bumps every user transaction and sponsors activation reserves                                                          |
| Mobile                | An installable **PWA** inside `apps/web` (Capacitor later if the stores are needed)                                                             |
| App features (v1)     | Send/receive dollars, `@handles`, pay charges by QR, pay shop QRs (AR interoperable, PIX) through a merchant                                    |
| Who confirms the fiat | The party that receives the local money (or its bot) releases; deadlines refund; disputes go to an arbiter                                      |
| Matching              | The user types an amount and the market picks the merchant (no ads book)                                                                        |
| Client tools          | Merchant bots via API, embedded buy/sell for businesses, collections (charges) and payouts                                                      |
| Repo                  | Private `Emanuel250YT/pedospe`, local folder `C:\Users\emanu\OneDrive\Desktop\pedospe` (both still under the old name), npm workspaces monorepo |
| UI languages          | Spanish (default), English and Brazilian Portuguese                                                                                             |

## 2. History you should know

1. The market was first built inside another company's repositories (the owner's employer,
   Cosmos Pay); the owner then said it must be independent. Those pull requests were closed
   unmerged. **Never put Midpoint work in Cosmos Pay repositories, never copy their infrastructure,
   and never use Cosmos Pay's Pollar app**: Midpoint needs its own.
2. 2026-11-19, first build (EVM): Solidity contract, NestJS API with viem and SIWE, React web with
   browser wallets, all merged into `main` (`1dcd8a1`, handoff `a52dd3f`).
3. 2026-11-19 evening, the pivot: everything moved to Stellar and the payments app was added, on
   branch **`feat/stellar`**. The spec `docs/STELLAR.md` and the shared package
   `packages/payment-qr` came first; three agents then built, in parallel worktrees, the Soroban
   contract (`feat/stellar-contracts`), the API + SDK + dev stack (`feat/stellar-api`) and the
   web + app (`feat/stellar-web`). The orchestrator merged them into `feat/stellar`, fixed what the
   reviews found and ran every gate on the merged tree (section 5). **`feat/stellar` is not merged
   into `main` and nothing of it is pushed yet.**
4. Automated security reviews ran on every commit; their findings were fixed (section 7).

## 3. Layout and stack

| Workspace                                      | Stack                                                                                                                                               | Docs                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/contracts` (`@midpoint/contracts`)   | Soroban contract in Rust (`soroban-sdk` 29.0.1, Rust 1.97.1 pinned, `wasm32v1-none`); committed wasm + spec as a TS artifact; Vitest + `cargo test` | [`packages/contracts/README.md`](../packages/contracts/README.md) |
| `packages/payment-qr` (`@midpoint/payment-qr`) | Dependency-free TS: StrKey, SEP-7, the app's payment/charge links, handles, EMVCo merchant QRs (PIX, AR interoperable) behind `parseScan`           | source docblocks                                                  |
| `apps/api` (`@midpoint/api`)                   | NestJS 12, Prisma 7 + Postgres, `@stellar/stellar-sdk` 17.4 (Soroban RPC), Vitest + SWC; OpenAPI `apps/api/openapi.json` (89 operations)            | [`apps/api/README.md`](../apps/api/README.md)                     |
| `packages/sdk` (`@midpoint/sdk`)               | openapi-fetch client typed from the spec, webhook verification, reference merchant bot (signs `release` with a Stellar key)                         | [`packages/sdk/README.md`](../packages/sdk/README.md)             |
| `apps/web` (`@midpoint/web`)                   | Vite 8 + React 19 + React Router 8 + Tailwind 4, stellar-sdk, Pollar (lazy chunk), jsQR fallback, hand-written service worker, Playwright           | [`apps/web/README.md`](../apps/web/README.md)                     |

Tooling: Node 26, TypeScript **6.0.3**, ESLint (forbids relative imports in `src`/`test`),
Prettier, `cargo fmt` + `clippy -D warnings` for the contract. Root scripts `build`, `test`,
`typecheck`, `lint` run across workspaces (contracts and payment-qr build first; others import
their `dist/`). Stellar CLI 25.1 is installed (not needed to build: see section 10).

## 4. Run it locally (the test server)

```
npm install
npm run dev:stack -- --testnet          # build, then bring the whole market up on Stellar testnet
npm run dev:stack -- --stop             # stop it (or Ctrl+C in its own terminal)
npm run dev:stack -- --reset            # fresh database and a fresh deployment
npm run dev:stack -- --no-web
npm run dev:stack -- --api-port 4300 --web-port 3300 --pg-port 54349   # other ports
npm run dev:simulate -- <orderId> --api http://localhost:4100           # play the merchant
npm run dev:mock -w @midpoint/web        # the whole web with no backend (demo wallet)
```

- Defaults: API **:4100**, web **:3100**, embedded Postgres **:54339**. Network: Stellar `local`
  (quickstart) only when a Docker daemon already answers, otherwise **testnet with friendbot**
  (`--testnet` forces it). Docker Desktop is never started.
- It creates and keeps in `.dev-stack/` the owner, arbiter, treasury, matcher, sponsor, SEP-10
  signer, merchant, business, user and a `TUSD` issuer; deploys the market; seeds through the API
  (organizations, `pk_test_` keys, SEP-10 wallet proofs, payment methods, BOB/ARS/BRL offers and
  `ar_qr`/`br_pix_qr` QR offers in the dollar and XLM, liquidity, the matcher authorised, a
  charge of 150 BOB, the user activated by the sponsor and given dollars). It prints the URLs,
  keys and the dev secret keys (testnet only).
- **Tokens (since 2026-11-20, for the Bolivia hackathon): the testnet market lists only Circle's
  USDC and XLM.** `P2P_TESTNET_TOKENS` is `[{"native":true}]` (USDC comes from the network table;
  XLM through its SAC, `issuer: null`, no trustline; the stack's owner key allows it on a market
  deployed before). The stack's USDC is real testnet USDC bought with test lumens on the testnet
  DEX (`apps/api/src/dev/dev-dollars.ts`: a throwaway friendbot account path-pays XLM→USDC
  straight to the merchant, then merges its leftover lumens into it; the DEX is deep, ~0.71 USDC
  per XLM). Each merchant keeps **5 000 USDC** of liquidity (the seeded one too) and the dev user
  1 000 USDC. TUSD (minted by the stack's issuer) is listed only on the fully local quickstart
  network, which has no Circle USDC; it stays allowed on the contract of a testnet market
  deployed before, unlisted, and the TUSD already deposited there was not withdrawn.
- **Currencies: the boliviano (BOB) is the main one** and the market lists it first (`BOB`,
  2 decimals, country `BO`, then PEN, BRL, ARS, CLP, COP, MXN: its neighbours first). Its one rail is
  `bo_bank_transfer` ("Bank transfer"): `bank` (bank name), `accountType` (`savings` |
  `checking`), `accountNumber` (spaces, dots and hyphens dropped, then 6 to 20 digits),
  `documentType` (`CI` | `NIT` | `CE` | `PP`) and `documentNumber` (spaces, dots and hyphens
  dropped, then 5 to 15 letters or digits, uppercased: a CI with complement `1234567-1A` becomes
  `12345671A`), all required; summary `<bank> ••••1234`. No Bolivian QR rail yet.
- The stack runs **three automated test merchants**: Andes Cambio, Illimani Pagos and Río Express
  (keys and set-up in `.dev-stack/merchants.json`, created on the first run and reused after;
  Illimani Pagos keeps its old state key `pampa`, so a running market keeps its funded merchant).
  Each has its own organization, `pk_test_` key, payment methods (a Bolivian bank transfer first
  — Banco Unión, Banco Mercantil Santa Cruz, Banco BISA, company NITs — then ARS, BRL, MXN, COP,
  PEN, CLP between them, plus `ar_qr` / `br_pix_qr` and, all three, `pe_qr`: Peru's
  interoperable QR of Yape, Plin and the banks, whose static QRs carry the account as an opaque
  token and no amount, so the person types it), offers in USDC and XLM (dollar orders up to
  2 000 USD), liquidity and the matcher. The seeded merchant (Oriente Cambio) collects in BOB
  (Banco Nacional de Bolivia), ARS and BRL. **Every start syncs the seed and the merchants,
  idempotently, without a reset** (`apps/api/src/dev/merchant-sync.ts`): missing payment methods
  and offers are added, active offers in a token no longer listed (TUSD) are deactivated through
  the API (never deleted), offer bounds that drifted are resized, dollar liquidity below 90 % of
  its target is topped up and spare lumens deposited, the user gets its dollars and a charge in
  an unlisted token is replaced. A bot per merchant (`packages/sdk` simulated merchant,
  `[bot-<slug>]` in the log) accepts sales and QR payments and marks them paid, and releases
  paid purchases, 5 s later. On the order's chat it sends the person a PDF transfer receipt
  ("Comprobante de transferencia", written by `packages/sdk/src/bot/receipt.ts`) right after it
  marks a sale or a QR payment paid, and answers the person's first message on an order once,
  3 s later (`REPLY_DELAY_SECONDS`). Every minute the four merchants' active offers are repriced from
  live mainnet references (CriptoYa USDT quotes per currency, `usdt/bob` included, with an FX
  fallback; the XLM/USDC book on the public Horizon) with spreads of 0.6 / 0.9 / 1.2 % and
  1.5 % for the seeded (manual) merchant, so the automated ones usually win the match;
  deactivated offers are left alone. XLM is not on mainnet:
  adding `nativeTokenOf('mainnet')` to `tableTokens` lists it there. The web's `tx-verify.ts`
  checks the XLM shapes: a send is the SAC's `transfer` to any destination with no memo on chain
  (the person's note stays off chain), and the activation is only the missing account (begin,
  create with nothing in it, end, as the sponsor's transaction). The app's home screen shows a
  chip per listed token; the person's pick is remembered (`midpoint.app.token`).
- Clicking through: open the web's `/app` and sign up or sign in with Pollar (email code or
  Google; needs `VITE_POLLAR_PUBLISHABLE_KEY`, section 8, and the web on an origin the Pollar app
  allows, today `http://localhost:3300`). To use a printed dev secret instead, open
  `/app?dev` (or have no Pollar key): **"Clave de desarrollo"** appears under the form (the
  dev-key wallet, compiled out of production builds); paste the `user` secret, or the
  `merchant` / `business` secret on `/dashboard?dev`.
- Mock mode (`dev:mock`) shows no demo banner: sign up or sign in with any email and any 6-digit
  code. `<persona>@demo.test` picks a demo persona (`user`, `merchant`, `business`, `fresh`);
  any other email is a new wallet on sign-up, the funded person on the app's sign-in and the
  merchant on the dashboard's (`personaForEmail` in `apps/web/src/lib/mock/wallet.ts`).
- To try a shop QR, paste an EMV payload in the app's scan screen (the tests in
  `packages/payment-qr/test` show how to build one with a valid CRC).
- A phone cannot use the local stack: the camera, the service worker and installing need HTTPS,
  so phone testing waits for a deployment (the owner's VPS, never a tunnel).

## 5. Verification status (on the merged `feat/stellar`, `b75f3eb`)

| Check                                               | Result                                                                                                                    | Who / where                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `npm install` (clean), `build`, `typecheck`, `lint` | pass (lockfile unchanged by a clean install)                                                                              | orchestrator, clean worktree                                          |
| Contract                                            | `cargo test` 47 pass (all EVM tests ported + Stellar rules, randomized conservation) + Vitest 14 (artifact = fresh build) | orchestrator                                                          |
| Contract mutation checks                            | 12/12 caught                                                                                                              | contracts agent                                                       |
| Contract reproducibility                            | same wasm hash `371f5f54…` on two clean builds, another path with CRLF, and WSL Linux                                     | contracts agent                                                       |
| payment-qr                                          | 16 pass (PIX manual CRC vector, SEP-23 vectors, duplicate-field and fail-closed cases)                                    | orchestrator                                                          |
| SDK                                                 | 56 pass                                                                                                                   | orchestrator                                                          |
| API unit + e2e wiring (embedded Postgres)           | 473 pass (every route vs wrong callers, scopes, roles, tiers, orgs, CSRF, revoked keys, SEP-10 replay and cross-purpose)  | orchestrator                                                          |
| API chain e2e on **testnet**                        | 5/5: sponsored activation, gasless transfer to an `@handle`, BUY, SELL, QR_PAY, a charge paid from the balance            | API agent (`E2E_STELLAR=testnet npm run test:chain -w @midpoint/api`) |
| Web unit                                            | 224 pass (102 are the ported transaction checks)                                                                          | orchestrator                                                          |
| Web Playwright (mock mode)                          | 54 pass: 18 flows × Pixel 7, iPhone 14 (Chromium) and desktop, es/en                                                      | orchestrator                                                          |
| Web against the real testnet stack                  | dev-key sign-in, send, BUY, QR_PAY, charge from the balance, dashboard sign-in and deposit                                | web agent; sign-in → home with balance re-checked by the orchestrator |
| Contract testnet smoke                              | deposit → set_matcher → open → mark_paid → release; a push to an unfunded treasury credited                               | contracts agent                                                       |

**Never verified:** Pollar itself (no publishable key yet: email/Google login, `signTx`,
`sep10.sign` are typed against its 0.12 `.d.ts` only), mainnet, the `local` (quickstart) network,
the deploy CLI end to end, the SDK bot against a live API, the service worker in a production
build, WebKit, the camera path on a device, a real bank or a real shop QR payment.

## 6. Design

The binding details are in [`docs/STELLAR.md`](STELLAR.md) and each workspace's README; this is the
map.

### 6.1 Contract (`packages/contracts/contracts/p2p-market`)

- Same rules as the first (EVM) build: free balances, operators with permission bits
  (`PERM_OPEN 1`, `PERM_RELEASE 2`, `PERM_TRADE 4`, `PERM_WITHDRAW 8`), matchers with a per-order
  cap and `auto_settle`, `open` / `open_with_deposit` with refs unique per opener, optional buyer
  bond with an acceptance step, `mark_paid`, `release`, `settle`, `cancel` (always refunds the
  seller), `dispute`, `resolve` by the arbiter. Statuses
  `None 0, Offered 1, Active 2, Paid 3, Disputed 4, Released 5, Cancelled 6, Resolved 7`.
- Stellar specifics: the acting address is an explicit argument with `require_auth()`; pulls are
  SAC `transfer` under the payer's auth (no approve); a push the token refuses (missing trustline,
  frozen) is **credited** to the recipient's market balance; storage TTL extended to 30 days when
  under 15; **not upgradeable** (the owner can never move funds).
- Fees: protocol fee (cap 300 bps) + integrator fee (cap 500 bps) from the buyer's proceeds,
  snapshotted at open. Pause stops new money in, never money out. Two-step ownership.
- Errors are `Error(Contract, #code)` (table in the package README); codes 1 and 3 never fire
  (the host's auth check refuses first).

### 6.2 Roles and keys

| Role                        | Holder                                                             | Key location                                                                                |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| owner, arbiter              | the operator (multisigs on mainnet)                                | outside the server; the API only builds unsigned XDR for them                               |
| treasury                    | address only                                                       |                                                                                             |
| matcher                     | the API                                                            | `P2P_MATCHER_SECRET`: opens orders within caps, acts for buyers; pays its fees              |
| sponsor                     | the API                                                            | `P2P_SPONSOR_SECRET`: fee-bumps user transactions, pays activation reserves; holds only XLM |
| SEP-10 signer               | the API                                                            | `SEP10_SIGNING_SECRET`: signs auth challenges; never funded                                 |
| users                       | Pollar (test: Pollar-custodied; live: Turnkey) or their own wallet | never on our servers                                                                        |
| merchants, businesses, bots | themselves                                                         | their wallets; bots preferably a release-only operator key                                  |

Production refuses to start unless the matcher, sponsor and SEP-10 secrets are all present and
distinct. **Trust edge:** a leaked matcher key plus a leaked arbiter key could drain merchant
liquidity through fake disputes; owner and arbiter must be multisigs and `autoSettle` is never
offered to liquidity merchants.

### 6.3 API

- **Tenancy/auth:** organizations with members, API keys `pk_live_` / `pk_test_` (tier by prefix,
  every query filtered by organization AND tier), members' headers `Midpoint-Organization` /
  `Midpoint-Tier`. Wallet sign-in is **SEP-10** (`GET /v1/auth/challenge`, `POST /v1/auth/verify`,
  plus the standard `/v1/auth/sep10` pair and `/.well-known/stellar.toml`); wallet proofs for
  account registration use SEP-10-shaped challenges bound to the organization.
- **Transactions:** every user transaction is built by the API as a prepared XDR (source = the
  user, one operation, 5-minute bounds). The wallet signs; `POST /v1/app/submit` or
  `/v1/p2p/submit` checks the policy (source, one allowed operation, passphrase, bounds, fee cap,
  per-address/IP limits, daily budget), fee-bumps with the sponsor, persists, submits and reports.
  Activating a missing account is the one shape whose source is the sponsor.
- **Flows:** BUY (matcher `open` on the merchant's liquidity), SELL (user `open_with_deposit`,
  merchant accepts with a bond), **QR_PAY** (like SELL, the destination is a scanned EMV payload on
  rails `ar_qr` / `br_pix_qr`; windows 2 min / 10 min / 1 h settle; payload sealed, shown only to
  the merchant while live), CHARGE (payers in local money, or **from the app balance**), PAYOUT,
  **transfers** between wallets (classic payment or SAC transfer), **handles**, **activity**
  (orders + transfers + external incoming payments from CAP-67 events, about 7 days back).
- **Chain layer:** Soroban RPC; a deployment is served only if its wasm hash equals the artifact
  and its tokens are allowed; the matcher is a serialized queue per network (one transaction per
  ledger); the indexer reads `getEvents` from a persisted cursor with compare-and-swap transitions
  committed with their webhook outbox rows; refusals are named after the contract that raised
  them (market error, or `Token…` for a SAC).
- **Webhooks:** transactional outbox, `midpoint-signature: t=<unix>,v1=<HMAC-SHA256(secret, t.body)>`,
  backoff, SSRF guard, per-role allowlisted bodies (no personal details, no `chainId` now).
- **Payment details and QR payloads** sealed at rest with AES-256-GCM (`DATA_ENCRYPTION_KEY`).

### 6.4 Web and the payments app

- `/app/*` (the payments app): welcome/sign-in, handle, home, scan, send, receive, add (BUY),
  withdraw (SELL), send to a bank account (SELL to a third party), pay a shop QR, pay a charge,
  order (with its chat) and activity detail, me. A floating dock for the tabs on phones, a side
  navigation from tablets up. PWA: manifest
  named from `src/lib/brand.ts`, icons from `scripts/gen-icons.mjs`, hand-written `pwa/sw.js`
  (never caches `/v1` or `/.well-known`), install prompts, offline page.
- Also: `/` landing, `/dashboard` (liquidity, offers incl. QR rails, payment methods, orders incl.
  the QR to pay for QR_PAY, charges, payouts, keys, webhooks, team), `/pay/{id}` and `/c/{id}`
  charge page, `/docs`.
- Wallets: `pollar` (lazy chunk, only with a publishable key; Freighter/Albedo in the dashboard
  through Pollar's built-in adapters), `demo` (mock mode only), `dev-key` (dev builds only). The
  app's token is `VITE_APP_TOKEN`, else the one the wallet holds, else USDC.
- The brand name lives in `apps/web/src/lib/brand.ts` and the API's `BRAND_NAME`.
- App behaviour (2026-11-20, the owner's asks):
  - **Sign in first, then the @handle**, a required step: a signed-in person without one is sent
    to `/app/handle?next=…` from any screen but the profile, offered a handle made from the
    sign-in email, then taken on to where they were going.
  - **Paste a QR** on the scan screen: a "Paste QR" button reads the clipboard (an image is
    decoded, text read as is), and Ctrl+V works anywhere on that screen.
  - **Paying a shop QR** takes the QR's own amount. When the balance cannot cover it at the
    market's approximate price (`approxPrice` / `usePrice` in `features/app/data.tsx`), the
    screen says so before any quote, with "Add money" opening `/app/add?currency=…&amount=…`
    already filled with what is missing (2 % over).
  - **Autofill** (`src/lib/app/remember.ts`, localStorage `midpoint.fill.*`, cleared on
    sign-out): the payer per currency and the payout account per rail come back in add money,
    withdraw and the charge page; the sign-in email fills email fields and suggests the handle.
  - **Layout and motion**: phones get the floating dock and 24px gutters. From 768px up there is
    a side navigation and a centred column of up to 820px, with 32px gutters: on a tablet the
    navigation is a rail of icons (88px), from 1024px it has the logo and the labels (260px).
    Screens enter forward from the right, back from the left, and tab switches fade. There is
    no tap highlight, and every control shows its own press.
- More of the owner's asks (2026-11-20, later; the hackathon is in Bolivia):
  - **Bolivia first.** BOB is the default currency everywhere (`HOME_CURRENCY` /
    `defaultCurrency` in `src/lib/p2p/rails.ts`; the app's pick is stored under
    `midpoint.app.currency.v2`). The rail is `bo_bank_transfer` (CI/NIT as the payer's document).
    The testnet market lists USDC and XLM only (no TUSD).
  - **Flags.** Each currency shows its country's round flag (`CurrencyMark` in
    `components/p2p/parts.tsx`, from `country-flag-icons`). Home's local-value line and the
    profile open a flag picker (`useCurrencyPicker`).
  - **Order chat and receipts.** Each order has a chat between the person and the merchant
    (`components/p2p/OrderChat.tsx`, `lib/p2p/chat.ts`, `lib/api/chat.ts`; routes
    `…/orders/:id/messages` for the app, an integrator and the merchant). Images or PDFs up to
    2 MB travel as base64 in JSON, and the browser checks their first bytes again before showing
    one.
    - Placement: beside the order on wide screens, below it on phones, and in the activity
      detail. The dashboard has a Chat button per order (an unread dot reads the per-browser
      seen marks in `lib/p2p/chat-seen.ts`), and the chat opens by itself right after a
      merchant marks an order paid, for the receipt.
    - The bots send a PDF receipt when they pay and answer a person's first message once.
  - **Errors are toasts, not lines on the screen** (the owner asked twice). A
    `Notice tone="error"` is only a toast (`components/ui/Toast.tsx`: tones ok/info/error,
    de-duplicated, a top-layer popover so it shows over dialogs). Only an
    error that is a state of the screen keeps its line (`<Notice tone="error" stay>`): could not
    load, a QR not taken, a quote or sale that failed its check, a payout file missing columns,
    a suspended wallet. Form fields keep their own validation under them.
  - **Where toasts show** (the owner, 2026-11-21): on a phone they come down from the top like a
    notification and go back up (a swipe up dismisses one); from 768px up they stack in the top
    right corner, in and out from the right edge (a swipe right dismisses one). The newest is on
    top, three at most, a tap dismisses any (`components/ui/toast-model.ts`).
  - **Responsive first, phones kept** (the owner, 2026-11-21). The welcome and sign-in
    (`features/app/Welcome.tsx`): one column on a phone; on a tablet the same, centred; from
    1024px split, the aura on the left and the words or the form centred on the right, with
    "no account? create one" right under the form. The home's action tiles shrink their label
    with the tile (a size container) instead of cutting it; Receive's amount and note line up
    side by side (a subgrid).
  - **Google login** (Pollar's hosted OAuth in a new tab): the redirect is the page's origin,
    registered in Pollar's dashboard under Developers > Websites > Allowed redirect URIs
    (`http://localhost:3300`; Google itself needs nothing, Pollar uses its own credentials). The
    waiting screen can cancel it instead of waiting out Pollar's 5-minute `LOGIN_TIMEOUT`.
  - **A sale's opening is built when the seller signs.** One simulated at creation goes stale
    when another order takes the order id its footprint names: that was the owner's failed sale
    (`scecExceededLimit`, "outside of the footprint"). `SignFlow` asks
    `POST /v1/app/orders/:id/transactions { action: 'open' }` and, if the network still refuses
    it, builds and sends it once more (`retryOnFail`).
  - **Re-quote before opening.** A price with under 15 s left is asked for again first. A worse
    one stops with "the price was updated" (the person confirms again); a refused quote
    (`quote_expired`, `quote_not_found`, `no_match`) says the same instead of an error.
  - **Sessions are not interrupted** (`src/lib/session.tsx`).
    - A 401, a session near its end (a day before, or halfway when it is shorter) or a page
      that comes back without its session renews the API session silently through the wallet
      at hand: Pollar's embedded signer signs the SEP-10 challenge.
    - While that runs, actions wait ("Connecting your wallet…"). If it cannot be done, no screen
      stays up without a session: the app and the dashboard show the sign-in, which says the
      session ended (`sessionGate`), and land back on the same screen after it. So does a page
      that comes back without its session when its wallet cannot renew it. Any 401 from any
      screen goes through it (`setUnauthorizedHandler` in `src/lib/api/client.ts`), and the error
      toasts that screen raised are cleared (the owner, 2026-11-20).
    - A session whose wallet did not come back (Pollar lost its own, a new tab with a dev key)
      is ended too: nothing could be signed with it. While the wallet is still coming back the
      screen waits on the loading view. An ended session loads nothing in the background
      (`useAppData` reads no address), checked live: no API call while the sign-in is up.
    - What the session says ("your session ended", "sign in again to sign") is a toast, not a
      line in the form (`useToastWhen` in `components/ui/Toast.tsx`).
    - The wallet kind is kept in localStorage, so a new tab keeps it.
  - **Peru's QR** (Yape, Plin, the banks) is the rail `pe_qr`. Yape puts its account in field 39
    as an opaque token, which `@midpoint/payment-qr` accepts for PE only.
  - **Send to a bank account abroad** (`/app/send/bank`): a sale whose beneficiary is someone
    else (`TradeForm recipient="other"`).
    - A CBU, CVU, alias, CCI or CLABE typed in Send's "To" is recognised and opens it filled in
      (`lib/app/bank-recipient.ts`).
    - A third party's ID is not asked where the rail's transfers do not need it (AR, PE, BO,
      BR, MX; the owner: their bank already did the KYC). Chile's RUT and Colombia's document
      are still asked. The API applies the same rule to sale and payout beneficiaries.
  - **Amounts in local money.** A sale can be typed either way (`TradeForm`: both figures are
    fields, the one typed drives the quote, `fiatAmount` or `tokenAmount`). Sending to a bank
    account starts in what arrives ("20 PEN") with the dollars under it; withdraw starts in USDC.
    Receive asks in any unit from one picker: a token of the network (USDC, XLM: the request is
    in that token) or any currency the market pays out in, which becomes the wallet's token at the
    market price, rounded up to the cent (`tokensForLocal` in `src/lib/app/money.ts`), saying what
    reaches the wallet. The request itself (link, SEP-7) always carries a token amount.
  - **An Argentine account is one field** ("CBU, CVU o alias"): what is typed goes to `cbu` (digits)
    or `alias` (anything else) by `oneOfKey` in `src/lib/p2p/rails.ts`; the API still gets one of
    the two keys, never both.
  - **The highlighter covers the whole amount** (`.marker` in `global.css`: wider padding given
    back by a negative margin, so nothing moves).
  - **`{brand}` never shows**: the i18n context's fallback is the filled catalog too (a context left
    behind by a hot reload used to read the raw one).
  - **Activity rows that moved nothing** (an order failed, cancelled, expired or rejected; a failed
    transfer) are struck through in red and say their status in plain words instead of a pill. An
    order that never opened (`failed`) reads "Cancelada" everywhere. A send to someone else's
    account reads "Enviaste a {name}" on the device that sent it.
  - **Every action goes out once** (the owner: no spamming a button, and a retry of something
    done is not an error).
    - Web: `useAction` / `useGuard` (`src/lib/use-action.ts`) drop a second tap with a ref, before
      any render; `SignFlow` has the same guard. After an action went through, the order screen,
      the QR payment and the dashboard's orders keep its buttons off ("sent, waiting for the
      network") until the order's status moves. `request()` (`src/lib/api/client.ts`) shares one
      answer between identical writes in flight.
    - API: a retried order action that already happened answers `409 already_done` (a transaction
      build, `details: ['status: …']`) or `200` with the order (a buyer's act), checked against
      the stored status and, when simulation reverts, the chain (`domain/action-outcome.ts`,
      `p2p/order-outcome.ts`). `SignFlow` counts `already_done` as a settled step.
  - **Receipts are files with a preview** (`src/components/p2p/ReceiptFile.tsx`): an image is
    drawn as it is; a PDF in the browser's own viewer where it has one inline
    (`navigator.pdfViewerEnabled`: desktop, iPhone), a document card elsewhere (Android). A
    merchant marks an order paid in the dashboard only with the receipt attached (previewed); it
    goes to the customer's chat once the order is paid. pdf.js would draw PDFs on every phone but
    is not a dependency yet (its install needs the owner's OK).
  - **Restarting the API** means restarting the whole stack (`npm run dev:stack -- --stop`, then
    the same start command): the launcher's watcher stops everything when the API process exits.
- The look ("night and aura", 2026-11-20, after a Dribbble banking-app reference the owner chose)
  is defined in `apps/web/src/styles/global.css`: near-black ink on a cool white page with white
  sheets; one atmospheric gradient textured with halftone dots and grain (`.aura`,
  `.aura-screen`, `.aura-night`, `.aura-card` + `.grain`) only for the welcome, the home balance,
  the wallet cards (receive, me) and the landing's hero and closing; `.tone-light`,
  `.tone-dark` and `.tone-glass` set the palette for part of a page whatever the theme; pill
  buttons (`.btn-white`, `.btn-glass` on the aura);
  action `.tile`s with tracked capitals (`.caps`); wide uppercase `.display` headlines on the aura;
  an ice highlighter (`.marker`) for the exact amount.
- The logo (2026-11-20, the owner's choices on the logo canvas): MIDPOINT drawn from the hero's
  letters (Archivo at width 116, weight 720), every letter cut on a slant with its lower part slid
  right, POINT at 50 % with its O whole and a dot at its centre. Flat, in the current colour, on
  no tile (`Logo`); the cut M alone is `LogoGlyph`. Only the favicon and the app icons set the M on
  an ink tile. The outlines are generated: `python apps/web/scripts/gen-logo.py` (fontTools,
  brotli, skia-pathops) writes `apps/web/src/components/ui/logo-paths.ts` from the app's own
  font file, then `npm run icons -w @midpoint/web` redraws `public/favicon.svg` and the PNGs.

## 7. Security invariants (keep them)

- Non-custodial: no server key can move anyone's tokens; the contract is the boundary.
- Every query is scoped by organization AND tier; another tenant's or tier's row is a 404.
- Keyless routes never let an id alone spend: budgets, caps, one live order per single-use charge.
- The sponsor pays only for allowlisted operation shapes, within rate limits and a daily budget.
- Merchant and client webhook bodies are per-role allowlists.
- **Before any wallet signature, the web decodes the API-built XDR and pins every field to a
  trusted source** (`apps/web/src/lib/p2p/tx-verify.ts`): network passphrase, source, one
  operation, bounds, fee cap; contract and function and every argument (decoded by name from
  `MARKET_SPEC`); auth entries only source-account credentials with the expected SAC transfer as
  the only sub-invocation; classic payments to what the user confirmed; a charge paid from the
  balance pinned to the app's token, the shown recipient and amount; the signed result must equal
  what was checked. A missing expectation is a refusal.
- **SEP-10 sign-in is pinned** to the configured home domain, the matching `web_auth_domain` and
  the `SIGNING_KEY` of this origin's `stellar.toml` (with its signature), never to values read
  from the challenge.
- **EMV QR parsing fails closed** (`packages/payment-qr`): a bad CRC, a repeated field, a second
  PIX account, an unparsable account or additional-data template, or an amount without a known
  currency is refused, so the person never agrees to one amount or payee while another is paid.
- The SDK bot pins the market contract locally, accepts only `release(own address, id)` with no
  sub-invocations, caps fees and bounds, and hard-codes network passphrases.
- Mock mode, the demo wallet and the dev-key wallet are compiled out of production builds; dev
  routes (`/v1/dev/*`) are refused in production and on mainnet.

## 8. Open decisions and set-up for the owner

1. **Pollar app for Midpoint** (never another company's): publishable key
   (`VITE_POLLAR_PUBLISHABLE_KEY`), allowed origins (`http://localhost:3100`, `:3000` and
   production), email OTP + Google, signing rules allowlisting only the market contract's user
   functions, the USDC/TUSD SAC `transfer`, classic `payment` / `change_trust` of those assets and
   SEP-10 for our home domain; a prompt-style confirmation policy; Pollar's own fee sponsorship
   off (our API sponsors). Checklist in `apps/web/README.md`.
2. **The new product name** (one constant per workspace, then the `@midpoint/*` scope, repo and
   domain).
3. Protocol fee value (contract cap 3%).
4. Owner and arbiter multisig addresses and the treasury address.
5. Funding of the matcher and the sponsor (XLM) per network and the sponsor's daily budget and
   abuse limits (`SPONSOR_*`); which networks/tokens launch (Circle USDC on mainnet).
6. Should a merchant that accepted a sell (or a QR payment) and never paid lose its bond on
   expiry? Today it gets it back (only a dispute can take it): a contract change.
7. A single-use charge allows one live order at a time (the link holder can make the payer wait up
   to 30 min). Acceptable?
8. Fees are paid by the person (buyer pays the gross, receives the net). Intended?
9. Hosting: a deployment on the owner's VPS (HTTPS) is needed to test on a phone and to install
   the PWA. Meanwhile (the owner, 2026-11-21: not on the VPS for now) a temporary hosted test
   market on Railway, apart from the local stack: `deploy/railway/README.md`, `npm run hosted`.
10. **Legal:** in Argentina, a service that matches fiat-crypto exchanges between third parties and
    charges fees likely needs CNV PSAV registration (RG 1172/2026). Paying shop QRs through
    merchants adds payments-regulation questions. Get a lawyer's opinion before any live launch.

## 9. Known risks and backlog

- Matcher throughput: one transaction per ledger per network; channel accounts would lift it.
- Concurrent activations of missing accounts can collide on the sponsor's sequence (the client
  retries).
- Indexer recovery after its cursor falls out of RPC retention (~7 days) and the sponsor-paid
  restore preamble are unit-tested only. External incoming payments in activity go back about 7
  days.
- The web names a contract error at **submission** time from the error text's code
  (`apps/web/src/lib/wallet/sign.ts`), so a token refusal there could read as a market error; the
  API's simulation path already attributes by origin (`refusalName`). Submission failures are rare
  because every transaction is simulated when built.
- Rate limiters are in memory (per replica).
- Pollar: LOBSTR/xBull not offered (the wallets-kit adapter pulls Reown/Trezor/Ledger); passkey
  (C-address) Pollar wallets are refused; recovery opens Pollar's own modal.
- The local-money equivalent on the home comes from a 10-unit sell quote (no price route).
- QR_PAY windows are pinned in the web to 120/600/3600 s, not cross-checked with the market's.
- `GET /v1/auth/session` answers 401 when signed out (console noise).
- `dev:stack --stop` can leave an orphaned embedded-Postgres worker holding its port (stop that
  single PID).
- No `DATA_ENCRYPTION_KEY` rotation; no webhook secret rotation or test send.
- Landing not prerendered (SEO); admin dispute screen not built; payout extras cut (CSV, retries).
- A build with Stellar CLI ≥ 25.2 (`stellar contract build`) has not been compared byte for byte
  with `npm run compile`.
- After an API spec change: `npm run openapi -w @midpoint/api`, then `npm run gen:api -w
@midpoint/web` and `npm run generate -w @midpoint/sdk`.

## 10. Environment gotchas (this Windows machine)

- Shell tools: the Bash tool is Git Bash (POSIX); never kill processes by name, only single PIDs
  (`taskkill //PID <pid> //F`). Never start Docker Desktop or other GUI apps from a session.
- `soroban-sdk` 28+ refuses to build except through `stellar contract build` from CLI ≥ 25.2 (it
  shakes the contract spec); this machine has CLI 25.1, so `npm run compile -w @midpoint/contracts`
  does the shaking itself. The `wasm32v1-none` target was added to the pinned Rust 1.97.1.
- `npm test -w @midpoint/contracts` takes about 1.5 minutes (cargo).
- stellar-sdk 17's XDR objects expose plain properties (`event.contractId`, `body.v0.topics`), not
  the accessor functions of older versions.
- Testnet: friendbot funds dev accounts; SDF's RPC keeps about 7 days of events.
- The repo lives under OneDrive: `node_modules`, `target/` and `.dev-stack/` are large; consider
  excluding the folder from sync.
- Worktrees from the 2026-11-19 sessions (remove with `git worktree remove <path>` when done):
  `C:/Users/emanu/wt/pst-contracts`, `pst-api`, `pst-web` (the agents' branches, merged),
  `pst-gates` (clean gate runs), `pst-preview` (a preview stack on :4300/:3300/:54349 with a
  throwaway patch), and the older `midpoint-api`, `midpoint-web`, `p2p-cs`, `p2p-dp`.
- The first EVM dev stack may still be running from the main folder (web :3000, API :4000, anvil
  :8545) and locks `node_modules` (anvil.exe): stop it before `npm install` there.
