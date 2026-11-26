# Stellar port and the mobile payments app: design contract

> **Status (2026-11-19):** implemented on `feat/stellar` and verified as described in
> `docs/HANDOFF.md` section 5. Where the code deliberately differs from this text, the code and the
> workspace READMEs win. The main differences:
>
> - activating a missing account uses the sponsor as transaction source;
> - submit takes `{ xdr, network? }`;
> - `P2pTransaction.action` is the contract function name in snake_case;
> - a SELL is one transaction;
> - contract functions return plain values, and error codes 1 and 3 never fire;
> - external wallets come from Pollar's built-in Freighter and Albedo adapters, not the
>   wallets-kit adapter;
> - the app's token is the one the wallet holds when `VITE_APP_TOKEN` is unset.

Binding spec for the work on branch `feat/stellar` (written 2026-11-19). Three agents build it in
parallel (contracts; API + SDK + dev stack; web + mobile app) and the orchestrator integrates. The
interfaces that cross a boundary (sections 3, 4, 5 and 7.2) are binding: if one is wrong or
impossible, pick the closest safe option, keep going, and say so in your report. Never diverge
silently.

## 1. Owner decisions (2026-11-19)

- **Everything moves from EVM to Stellar.** Solidity, viem, SIWE, anvil and EIP-6963 are removed,
  not kept alongside. What does not touch the chain stays.
- **A mobile app mode**: an installable PWA inside `apps/web`. It is a simple payments app, not
  just the market's buy/sell page.
- **User wallets come from Pollar** (`@pollar/react` + `@pollar/core` 0.12, docs
  https://docs.pollar.xyz, `llms.txt`). Email OTP or Google login gives the user a classic Stellar
  G account. External wallets (Freighter, LOBSTR, xBull...) come in through Pollar's
  `@pollar/stellar-wallets-kit-adapter`. Test mode: Pollar's wallet service custodies the keys.
  Live: Turnkey (co-signed or self-custody).
- **Gasless.** Users never hold XLM for fees. Our API pays them with a fee-bump from its sponsor
  account, and sponsors reserves when it activates an account or a trustline.
- **Features of the first version:**
  - send and receive dollars (USDC) between users, by QR, link or address, with history;
  - user handles (`@name`);
  - pay a business's charge by scanning its QR;
  - pay a shop's local-money QR through a market merchant (p2p.me "Scan & Pay" style): Argentina's
    interoperable QR (Transferencias 3.0) and Brazil's PIX.
- **The product is Midpoint** (renamed from "pedospe" on 2026-11-20). Keep the display name in one
  place per workspace (web: `src/lib/brand.ts`, passed into i18n strings as a parameter; API: a
  `BRAND_NAME` config value). Technical names (the `@midpoint/*` packages, the `Midpoint-*` request
  headers, the `midpoint-signature` webhook header, `MIDPOINT_*` variables, storage keys) are part
  of the API contract: change them only with a versioned migration.
- The UI stays in Spanish (default) and English. Its look ("night and aura" since 2026-11-20:
  near-black ink, white sheets, an ice-to-night gradient textured with dots, Archivo, an ice
  highlighter for the exact amount) is described in the handoff, section 6.4.

## 2. What stays and what is replaced

**Stays** (only address types and validation change): organizations, members, API keys and tiers,
offers, matching, pricing, rails, sealed payment details, charges, payouts, webhooks (outbox,
signature, SSRF guard), rate limits, i18n and the look.

**Replaced:**

- the contract;
- the chain layer (clients, codec, deployments, indexer, matcher sender);
- auth (SIWE becomes SEP-10);
- the web's wallet layer and its transaction checks;
- the deploy CLI;
- the dev stack's chain;
- the SDK's chain helpers.

## 3. Stellar basics used everywhere

**Networks:**

| id        | passphrase                                        | tier            |
| --------- | ------------------------------------------------- | --------------- |
| `local`   | `Standalone Network ; February 2017` (quickstart) | test (dev only) |
| `testnet` | `Test SDF Network ; September 2015`               | test            |
| `mainnet` | `Public Global Stellar Network ; September 2015`  | live            |

**Tokens.**

- Classic assets, used on-chain through their Stellar Asset Contract (SAC).
- The launch token is Circle's USDC:
  - mainnet issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`;
  - testnet issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.
- On testnet the dev stack trades Circle's USDC, bought for its merchants with XLM on the testnet
  DEX. Only the local network (stellar/quickstart, which has no Circle USDC) issues a dev dollar,
  `TUSD`, from a dev issuer.
- The native lumen (`XLM`) can be listed too (testnet and local today, through
  `P2P_<NET>_TOKENS` `{"native":true}`): it moves through its SAC like the others, has
  `issuer: null` and needs no trustline. A wallet's XLM balance is what it can SPEND (balance less
  the reserves it pays itself, sponsorship counted, and its selling liabilities); activating for
  XLM only creates a missing account (begin, create, end); app transfers and charge payments of
  XLM are always a SAC `transfer`. Mainnet lists it once `tableTokens` adds `nativeTokenOf`.
- All of them have 7 decimals. Amounts are base units: `i128` on-chain, a decimal integer string in
  the API.

**Addresses.**

- StrKey `G` for accounts and `C` for contracts. `M` (muxed) is accepted only as a payment
  destination.
- Validate with stellar-sdk `StrKey` or `@midpoint/payment-qr` `isStellarAddress`.
- Never change their case.

**Transactions a user signs.**

- The API builds and prepares every one (simulation, resource fees, footprint, a restore preamble
  when needed).
- Each has the user's account as source, exactly one operation, and time bounds at most 5 minutes
  ahead.
- The wallet signs the inner transaction. The API wraps it in a fee-bump paid by its sponsor
  account and submits it (section 5.4).

**Other shared rules.**

- **Order ref:** `sha256` of the order uuid's 16 bytes, as `BytesN<32>`. The API and the web derive
  it the same way. The web pins a sale's `ref_id` to it.
- **Libraries:** `@stellar/stellar-sdk` 17.x.
  - Soroban RPC for contract calls, simulation, events and ledger entries.
  - Horizon only where RPC has no equivalent.
- **Shared parsing:** `@midpoint/payment-qr` (already on `feat/stellar`) reads everything a user can
  scan or paste:
  - Stellar addresses, `@handle`s and SEP-7 `pay` URIs;
  - the app's own payment links (`/app/send?to=...`) and charge links (`/pay/<id>`, `/c/<id>`);
  - EMV merchant QRs (PIX, Argentina's interoperable QR), CRC checked.
    The API and the web both use it; do not re-implement any of it.

## 4. Contract (`packages/contracts`)

**Toolchain.** Soroban, Rust, `soroban-sdk` at the newest stable release that testnet's protocol
supports (check RPC `getVersionInfo` / `getNetwork`). Rust, the `wasm32v1-none` target and Stellar
CLI 25.1 are installed on this machine. Pin the toolchain in `rust-toolchain.toml` so the committed
wasm is reproducible.

**Semantics.**

- Identical to `contracts/P2PMarket.sol`. Port each of its 37 tests, including the randomized
  conservation property. The differences listed here are the only allowed ones.
- Crate `p2p-market`, contract `P2PMarket`.
- **Not upgradeable** (no `update_current_contract_wasm`): the owner can never move funds.

### 4.1 Types (`#[contracttype]`; names are binding)

```rust
#[repr(u32)] pub enum Status { None = 0, Offered = 1, Active = 2, Paid = 3, Disputed = 4,
                               Released = 5, Cancelled = 6, Resolved = 7 }
pub struct OpenParams {
    pub ref_id: BytesN<32>, pub seller: Address, pub buyer: Address, pub token: Address,
    pub amount: i128, pub bond: i128, pub accept_window: u32, pub payment_window: u32,
    pub settle_window: u32, pub integrator: Option<Address>, pub integrator_fee_bps: u32,
}
pub struct Order {
    pub seller: Address, pub buyer: Address, pub token: Address, pub opener: Address,
    pub integrator: Option<Address>, pub amount: i128, pub bond: i128, pub status: Status,
    pub from_balance: bool, pub via_matcher: bool, pub fee_bps: u32, pub integrator_fee_bps: u32,
    pub accept_deadline: u64, pub payment_deadline: u64, pub paid_at: u64,
    pub payment_window: u32, pub settle_window: u32, pub ref_id: BytesN<32>,
}
pub struct MatcherTerms { pub max_per_order: i128, pub auto_settle: bool }
pub struct Config {
    pub owner: Address, pub pending_owner: Option<Address>, pub treasury: Address,
    pub arbiter: Address, pub protocol_fee_bps: u32, pub paused: bool,
}
```

- Times are ledger timestamps in seconds.
- These constants keep the Solidity values: the fee caps (300 / 500 bps), the window bounds, and
  the permissions `PERM_OPEN 1`, `PERM_RELEASE 2`, `PERM_TRADE 4`, `PERM_WITHDRAW 8`.
- A negative amount is refused with `NegativeAmount`. The contract never mints, burns or moves
  anything but SAC tokens.

### 4.2 Functions

Where Solidity read `msg.sender`, the Soroban function takes the acting address as an explicit
argument and calls `require_auth()` on it. That address then plays the same role the sender did:
seller, operator holding a permission, matcher acting for the buyer, buyer, or anyone once a
deadline has passed.

```text
__constructor(owner, treasury, arbiter, protocol_fee_bps: u32)
set_protocol_fee(bps: u32)            set_treasury(treasury)        set_arbiter(arbiter)
set_token(token, allowed: bool)       set_paused(paused: bool)      // all: owner auth
transfer_ownership(to)                // owner auth
accept_ownership()                    // pending owner auth
deposit(account, token, amount: i128)                     // account auth; pulls from account
withdraw(account, token, amount: i128)                    // account auth
withdraw_for(operator, account, token, amount: i128)      // operator auth + PERM_WITHDRAW
set_operator(account, operator, perms: u32)               // account auth; 0 revokes
set_matcher(seller, matcher, max_per_order: i128, auto_settle: bool)   // seller auth
open(caller, p: OpenParams) -> u64          // caller auth: seller, operator with PERM_OPEN, or matcher within cap
open_with_deposit(p: OpenParams) -> u64     // p.seller auth; pulls p.amount from the seller
accept(caller, id: u64)    mark_paid(caller, id: u64)    release(caller, id: u64)
cancel(caller, id: u64)    dispute(caller, id: u64)      // caller auth, roles as in Solidity
settle(id: u64)                                            // anyone, no auth
resolve(id: u64, to_buyer: i128, bond_to_seller: i128)    // arbiter auth
// views
config() -> Config               get_order(id: u64) -> Order          // UnknownOrder if absent
order_id_of(opener, ref_id: BytesN<32>) -> u64                       // 0 = none
balance_of(account, token) -> i128           permissions_of(account, operator) -> u32
matcher_terms_of(seller, matcher) -> MatcherTerms    token_allowed(token) -> bool
order_count() -> u64                                                  // ids start at 1
```

**Token transfers.**

- _Pulls_ use `token::Client::transfer(from, contract, amount)`. `from`'s auth covers it as a
  sub-invocation, so there is no `approve`. A balance-diff check stays (`ShortDeposit`).
- _Pushes_ use `try_transfer`. When one fails (missing trustline, frozen, deauthorized), the amount
  is credited to the recipient's market balance and `credited` is emitted, the same as the EVM
  contract's "credit a refused push".

### 4.3 Events (`#[contractevent]`)

One event per Solidity event:

- the struct name is the snake_case of the Solidity event name, and is the first topic
  (`order_opened`, `order_paid`, `deposited`...);
- the fields that were `indexed` in Solidity are `#[topic]`;
- the other fields go in the data map, with snake_case names.

Exceptions:

- `order_opened` (topic `id`) carries every `Order` field except `paid_at`.
- `order_released.by` is `Option<Address>`: `None` when it came from `settle`.
- `order_cancelled.by` is `Option<Address>`: `None` when the cancellation needed no actor.

### 4.4 Errors (`#[contracterror]`, codes binding)

| code | name            | code | name                | code | name               |
| ---- | --------------- | ---- | ------------------- | ---- | ------------------ |
| 1    | NotOwner        | 9    | BadWindow           | 17   | WrongStatus        |
| 2    | NotPendingOwner | 10   | BadIntegrator       | 18   | Expired            |
| 3    | NotArbiter      | 11   | SameParty           | 19   | NotYet             |
| 4    | NotAuthorized   | 12   | RefTaken            | 20   | BadSplit           |
| 5    | IsPaused        | 13   | EmptyRef            | 21   | InvalidPermissions |
| 6    | ZeroAmount      | 14   | InsufficientBalance | 22   | NegativeAmount     |
| 7    | TokenNotAllowed | 15   | ShortDeposit        |      |                    |
| 8    | FeeTooHigh      | 16   | UnknownOrder        |      |                    |

`Reentrant` and `ZeroAddress` have no Stellar counterpart: the host forbids re-entry, and there is
no zero address.

### 4.5 Storage

- **Instance storage:** config, the next order id and allowed tokens.
- **Persistent storage:** orders, balances, refs, permissions and matcher terms, under a `DataKey`
  enum.
- **TTL:** extend the instance on every call. Extend a persistent entry when it is written, or read
  by a state-changing call. Document the thresholds in the crate.
- An archived entry is restored by its client (the API applies the simulation's restore preamble).
  It is never lost.

### 4.6 JavaScript exports (`@midpoint/contracts`, built to `dist/` as now)

```ts
export const MARKET_WASM_BASE64: string;              // the committed release wasm
export const MARKET_WASM_HASH: string;                // hex sha256 of that wasm
export const MARKET_SPEC: readonly string[];          // base64 XDR ScSpecEntry (contractspecv0)
export const MARKET_ERRORS: Readonly<Record<number, string>>; // code -> name
export const ORDER_STATUS, PERMISSIONS, LIMITS;       // same names/values as today where they exist
export type Order, OpenParams, MatcherTerms, MarketConfig; // JS shapes (bigint for i128/u64)
```

- **No runtime dependency.** Consumers decode with stellar-sdk's `contract.Spec(MARKET_SPEC)`.
- **`npm test`** runs `cargo test` (every ported test) plus a vitest artifact check: the committed
  wasm equals a fresh build, and `MARKET_SPEC` equals the wasm's spec section.
- **Interface first.** Commit the whole interface (types, functions, events, errors) and a built
  artifact BEFORE filling in the logic, so the API agent can merge `feat/stellar-contracts` early.
  Never change it later without saying so in your report.

## 5. API (`apps/api`)

### 5.1 Configuration

The EVM variables are replaced by these:

| Variable(s)                                          | What                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `STELLAR_<NET>_RPC_URL`, `STELLAR_<NET>_HORIZON_URL` | Per network. Horizon is optional.                                                                    |
| `P2P_<NET>_CONTRACT`                                 | The market contract on that network.                                                                 |
| (table in code), `P2P_<NET>_TOKENS`                  | Tokens per network: USDC issuers; XLM (`{"native":true}`), and the local network's `TUSD`, from env. |
| `P2P_MATCHER_SECRET`                                 | The matcher account. It opens orders and acts for buyers, paying its own fees.                       |
| `P2P_SPONSOR_SECRET`                                 | The fee-bump and reserve sponsor. Holds only XLM.                                                    |
| `SEP10_SIGNING_SECRET`                               | Signs auth challenges. Never funded.                                                                 |
| `SEP10_HOME_DOMAIN`                                  | The web host.                                                                                        |
| `SPONSOR_*`                                          | Per-address and per-IP rate limits, fee cap, daily XLM budget.                                       |
| `BRAND_NAME`                                         | The product name.                                                                                    |

- Production refuses to start when the matcher, sponsor and SEP-10 secrets are not three distinct
  keys.
- None of these keys can move a user's or merchant's tokens.

### 5.2 Auth: SEP-10 replaces SIWE

- `GET /v1/auth/challenge?account=G...` answers `{ transaction, network_passphrase }`, the SEP-10
  response shape. The challenge is a standard SEP-10 challenge:
  - signed by the SEP-10 key;
  - a `<home domain> auth` manage_data op with a random single-use nonce;
  - a `web_auth_domain` op;
  - 5-minute time bounds.
- `POST /v1/auth/verify { transaction }` answers `{ token, session }` and sets the HttpOnly cookie,
  as today. `token` is the `ps_sess_` bearer (SEP-10's `token` field). Verification follows SEP-10:
  - the server's signature, time bounds, home domain and nonce;
  - the client's signatures must reach the account's medium threshold (load its signers) when the
    account exists, or be the master key's when it does not.
- `GET /.well-known/stellar.toml` serves `WEB_AUTH_ENDPOINT`, `SIGNING_KEY` and
  `NETWORK_PASSPHRASE`. The web proxies `/.well-known` to it, as it does `/v1`.
- Wallet proofs for `/v1/p2p/accounts/challenge` + `/v1/p2p/accounts` use the same SEP-10-shaped
  challenge, plus a manage_data entry that binds the organization. Never a message signature.
- `Session` keeps its shape; `address` is now a G address.

### 5.3 Market view

- `NetworkView` = `{ id, name, networkPassphrase, rpcUrl, horizonUrl, explorerUrl, contract,
protocolFeeBps, paused, tokens }`. `chainId` and `nativeSymbol` go.
  - `rpcUrl` and `horizonUrl` are public endpoints (`horizonUrl` may be null).
  - `explorerUrl` is stellar.expert-style: append `/tx/<hash>`, `/account/<G>` or `/contract/<C>`.
    Null when there is none.
- `TokenView` = `{ symbol, code, issuer, contract, decimals }`, where `contract` is the SAC id and
  `issuer` is null only for the native lumen (`XLM`).
- The market gains `sponsor: { enabled: boolean }`.
- A deployment is listed only when its wasm hash equals `MARKET_WASM_HASH` and its tokens are
  allowed on-chain.

### 5.4 Transactions and gasless submission

- `P2pTransaction` = `{ network, action, description, xdr, hash, expiresAt }`:
  - `xdr`: a base64 unsigned, prepared `TransactionEnvelope`;
  - `hash`: the hex hash of the inner transaction;
  - `expiresAt`: its upper time bound.
- `POST /v1/p2p/transactions` (org) and `POST /v1/app/orders/{id}/transactions` (session) build as
  today, now as XDR. The `approve` action goes: a Soroban pull happens inside
  `deposit` / `open_with_deposit` under the payer's auth.
- **Submit:** `POST /v1/app/submit` (session) and `POST /v1/p2p/submit` (org, `p2p:write`) take
  `{ xdr }`, the signed inner envelope.
- **What the API checks before sponsoring:**
  - the network passphrase;
  - source = the session's wallet, or an account registered to the org and tier;
  - exactly one operation, of an allowed shape: an invoke of the market contract, a SAC `transfer`
    of an allowed token, a classic `payment` of an allowed asset, or the activation shape of 5.6;
  - the time bounds and a fee cap;
  - rate limits and the budget.
- **What it does then:**
  - fee-bumps with the sponsor when `sponsor.enabled`; otherwise submits as signed;
  - persists the submission before broadcasting;
  - submits, and waits up to about 15 s.
- **Answer:** `{ hash, status: 'PENDING' | 'SUCCESS' | 'FAILED', error }`.
  `GET /v1/app/submissions/{hash}` (and the org twin) polls it.
- **The matcher** keeps today's rules (sign, persist, then broadcast; rebroadcast only stored
  bytes), with the matcher account as source.

### 5.5 Indexer and jobs

- The indexer reads Soroban RPC `getEvents` for the market contract from a persisted cursor.
- Stellar has finality, so there is no confirmation count or reorg window. Keep:
  - compare-and-swap transitions committed together with their webhook outbox rows;
  - the field-by-field check of `order_opened` for sells.
- RPC event retention is limited (about 7 days on SDF's RPC). Document how a long-stopped indexer
  recovers.
- The expiry job, matcher follower and webhook sender keep their jobs.

### 5.6 New app endpoints (session: a wallet acting for itself)

**Profile and handles.**

- `GET /v1/app/profile` → `{ address, handle | null }`.
- `PUT /v1/app/profile { handle }` claims or changes it:
  - normalised with `normalizeHandle` from `@midpoint/payment-qr`;
  - unique, case-insensitive; reserved words refused;
  - `409 handle_taken` when someone has it.
- `GET /v1/app/handles/{handle}` → `{ handle, address }`, or 404. Rate-limited. There is no
  listing route.

**Balances.** `GET /v1/app/balances?network=` →
`{ network, account: { exists }, xlm, tokens: [{ symbol, contract, amount, trustline, authorized }] }`.

**Activation.** `POST /v1/app/activate { network, token }` → `{ transaction | null }`.

- It creates the account if it is missing and opens the token's trustline.
- The sponsor pays the reserves (CAP-33):
  1. `begin_sponsoring_future_reserves`, source = sponsor;
  2. `create_account` with balance 0, only when the account is missing;
  3. `change_trust`, source = user;
  4. `end_sponsoring_future_reserves`, source = user.
- At submit the API adds the sponsor's signature.
- `null` when there is nothing to do. Rate-limited per address and per IP, within the budget.
- Pollar wallets usually come with the trustline already (Pollar sponsors it). This covers every
  other wallet.

**Transfers.** `POST /v1/app/transfers { network, to, token, amount, note? }` →
`{ transfer, transaction }`.

- `to` is a G, C or M address, or `@handle`. `note` is at most 28 bytes and becomes a text memo.
- Refusals: a recipient that cannot receive (no trustline, or not authorized) →
  `recipient_cannot_receive`; a transfer to oneself; more than the balance.
- A G or M recipient gets a classic `payment`. A C recipient gets a SAC `transfer` invoke.
- `GET /v1/app/transfers/{id}` reads one back.
- `AppTransfer` = `{ id, network, token, amount, from, fromHandle, to, toHandle, note, direction,
status, hash, createdAt, completedAt }`:
  - `direction`: `'in'` or `'out'`, from the caller's side;
  - `status`: `PENDING`, `SUBMITTED`, `COMPLETED` or `FAILED`.

**Activity.** `GET /v1/app/activity?network=&cursor=&limit=` → `{ items, nextCursor }`, newest
first.

- Each item is `{ type: 'order', at, order }` or `{ type: 'transfer', at, transfer }`.
- Payments from outside the app also appear, as `transfer` items with `fromHandle: null`. Read them
  from SAC `transfer` events (CAP-67 unified events) or Horizon payments; pick one and document its
  window.

**Pay a charge from the balance.**

- `GET /v1/app/charges/{id}` shows the charge as its payer sees it, plus
  `payWithBalance: { token, amount, expiresAt } | null`.
- `POST /v1/app/charges/{id}/payments { network, token }` → `{ payment, transaction }`.
  - The transaction is a token transfer to the charge's receiving account.
  - The amount is what the business would have received, priced from the current best quote and
    valid for 60 s.
- The charge is paid once the submitted transfer succeeds, checked on-chain. The webhook stays
  `P2P_CHARGE_SUCCEEDED`, with `paidWith: 'TOKEN'`.
- The pesos path (the `/pay/{id}` checkout) stays.

**QR payments: a new order kind, `QR_PAY`.**

- **Rails.** `ar_qr` (ARS, Argentina's interoperable QR) and `br_pix_qr` (BRL, PIX BR Code). They
  take no account fields: the destination is the scanned payload. A merchant opts in by publishing
  a sell-side offer (it buys tokens) on these rails.
- **Quote.** `POST /v1/app/quotes { kind: 'QR_PAY', network, token, qr, fiatAmount? }`.
  - It parses `qr` with `parseEmv`: the CRC must be valid, the standard must match the rail, and
    the currency must be ARS or BRL.
  - A dynamic QR's own amount wins. When both are given, `fiatAmount` must equal it.
  - Matching works as for SELL.
- **Order.** `POST /v1/app/orders { kind: 'QR_PAY', quoteId, qr }` → the order plus an unsigned
  `open_with_deposit`, with a bond as for SELL.
  - Windows: accept 2 min, payment 10 min, settle 1 h. These are constants, all within the
    contract's bounds.
- **The merchant** sees `qr: { payload, standard, merchantName, merchantCity, amount, currency,
reference }` on the order. Only the counterparty sees it, and only while the order is live. The
  dashboard draws the QR from the payload, so the merchant pays it with its own banking app, then
  marks the order paid.
- **The user** releases from the app once the shop confirms. If nobody acts, the order settles
  after 1 h.
- The payload is sealed at rest like payment details. Webhooks are the SELL ones, with
  `kind: 'QR_PAY'`.

**Unchanged:** `/v1/app/quotes` and `/v1/app/orders` keep BUY and SELL.

### 5.7 Deploy CLI, dev stack and tests

**Deploy CLI** (`src/cli/deploy.ts`): uploads the committed wasm, creates the contract with its
constructor arguments and allows the tokens. Mainnet stays behind `--i-understand-mainnet`.

**`npm run dev:stack`.**

- Postgres as today.
- Stellar `local` (stellar/quickstart through Docker) when a Docker daemon answers; otherwise
  `testnet` with friendbot. Never start Docker Desktop.
- Creates these accounts and keeps them in `.dev-stack/`: owner, arbiter, treasury, matcher,
  sponsor, SEP-10 signer, merchant, business and user (plus a dev-dollar issuer on the local
  network only).
- Gives merchant, business and user testnet USDC bought with XLM on the testnet DEX (the local
  network mints its dev dollar instead), and deploys the market.
- Seeds through the API:
  - organizations, keys, and accounts proven by SEP-10;
  - payment methods, and offers that include `ar_qr` QR_PAY offers;
  - liquidity, the matcher authorisation, and a charge.
- Starts the API and the web, then prints the URLs, keys and the dev secret keys (local or testnet
  only).
- Lists XLM (the owner allows its SAC on a market deployed before it).
- Sets up three automated test merchants (Andes Cambio, Illimani Pagos, Río Express: their own
  organizations, keys, payment methods in every listed currency with Bolivia's first, offers in
  USDC and XLM, liquidity and the matcher), runs the SDK's simulated merchant for each, and
  reprices all four merchants' offers every minute from live mainnet references (CriptoYa with an
  FX fallback; the XLM/USDC book on the public Horizon), each with its own spread. A resumed stack
  syncs its merchants to this (missing methods and offers added, offers in unlisted tokens paused,
  USDC liquidity topped up).
- Keeps `--reset`, `--stop`, `--no-web` and `dev:simulate`.

**Tests.**

- Unit tests: XDR building and decoding, the submit policy, SEP-10, handles, QR_PAY parsing.
- The e2e wiring suite: every route against wrong callers, scopes, roles, tiers and orgs, on
  embedded Postgres. Fake the chain layer where a route needs none.
- A chain e2e suite gated by `E2E_STELLAR=local|testnet`. Run it on testnet at least once before
  reporting, and report the result.

## 6. SDK (`packages/sdk`)

- The typed client is regenerated from the new spec. Webhook verification does not change.
- The reference bot signs `release` with the merchant's Stellar secret (stellar-sdk `Keypair`) and
  submits through `/v1/p2p/submit`.
- The `viem` peer dependency becomes an optional `@stellar/stellar-sdk` peer.

## 7. Web (`apps/web`)

### 7.1 Wallet layer and sign-in

```ts
interface StellarWallet {
  kind: 'pollar' | 'demo' | 'dev-key';
  address: string; // G...
  label: string;
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>; // signed envelope
  signAuthChallenge(xdr: string, networkPassphrase: string): Promise<string>; // SEP-10
  logout(): Promise<void>;
}
```

**Pollar.**

- `PollarProvider` with `VITE_POLLAR_PUBLISHABLE_KEY`. The network follows the market tier:
  testnet for test, mainnet for live.
- Our own login UI: email OTP and Google. The dashboard also offers external wallets through
  `@pollar/stellar-wallets-kit-adapter`.
- Transactions: `signTx(xdr, { skipSponsorship: true })`. Our API sponsors, not Pollar.
- Challenges: `stellar.sep10.sign`.
- Read the real exported API of `@pollar/core` / `@pollar/react` 0.12 from their type definitions
  before coding.

**`demo`:** mock mode only, like today's demo wallet.

**`dev-key`:** dev builds only, compiled out of production builds like mock mode. It takes one of
the dev stack's printed secret keys and signs locally with stellar-sdk, to test against the local
stack without Pollar.

**Sign-in:** SEP-10 against our API as soon as the wallet is ready. The session works as today.

**What the owner must set up** (document it in the web README): a Pollar app for this product,
never another company's app. It needs:

- a publishable key;
- allowed origins (`http://localhost:3000` plus production);
- signing rules that allowlist the market contract's functions and the USDC and XLM SACs;
- a signature confirmation policy.

### 7.2 Checks before any signature (port of `tx-verify`; keep every rule)

Decode with stellar-sdk and `MARKET_SPEC`. Refuse unless:

- the envelope is not a fee-bump;
- the network passphrase is the market network's;
- the source is the signed-in wallet;
- there is exactly one operation;
- time bounds are present and at most 10 min ahead.

**Invoke operations.**

- The contract is the market (or an allowed SAC).
- The function and every argument are pinned to a trusted expectation. For a sale's
  `open_with_deposit`:
  - `seller` = the wallet;
  - `token` and `amount` from the accepted quote;
  - `buyer` from the order;
  - bond and windows from the market's published values;
  - the integrator rule;
  - `ref_id` = sha256 of the order uuid's bytes.
- Auth entries:
  - only source-account credentials;
  - the root invocation equals the operation's;
  - the only sub-invocation allowed is the expected SAC `transfer` from the wallet to the market
    contract, for the exact amount.

**Classic payments.** Destination, asset, amount and memo equal what the user confirmed. A handle
is shown with its resolved address.

**Activation.** Exactly the sponsored-activation shape, for an allowed asset.

A missing expectation is a refusal, never a pass.

### 7.3 The mobile app (`/app/*`; it replaces today's `/app` trade page)

**PWA.**

- A `manifest.webmanifest`: `start_url` `/app`, standalone, theme colours.
- Icons 192, 512, maskable and apple-touch, generated from the SVG mark by a script.
- A hand-written service worker:
  - caches the app shell and the hashed assets;
  - never caches `/v1`;
  - offers an update prompt.
- Install prompts: Android's `beforeinstallprompt`, and an iOS "Add to Home Screen" hint.
- Safe-area insets, no zoom on inputs, and an offline screen.

**Screens.**

- One main action per screen. Spanish copy first.
- Amounts in dollars, with the local-money equivalent.

| Screen              | What it does                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Welcome             | Sign in with Pollar (email OTP, Google), then claim an `@handle` (skippable).                                                                                                                                                              |
| Home                | The USDC balance and its local-money equivalent. Actions: Send, Receive, Add money (buy), Withdraw (sell), and a prominent Scan button. Recent activity. A banner when the wallet needs activation (5.6).                                  |
| Scan                | The camera: `getUserMedia` + `BarcodeDetector`, with a lazy-loaded fallback decoder under a permissive licence. Torch; paste or gallery fallback. Runs `parseScan` with the app's origins and routes the result. Warns on a secret key.    |
| Send                | Recipient (`@handle`, address, recent contacts, scan) → amount → note → review with the resolved address → sign → success, with share.                                                                                                     |
| Receive             | My QR: a payment link with my `@handle` or address, an optional amount and note, and a SEP-7 toggle for other Stellar wallets. Copy; share (Web Share API).                                                                                |
| Add money, Withdraw | Today's BUY and SELL flows, restyled as steps.                                                                                                                                                                                             |
| Pay merchant QR     | The merchant's name and city; the amount in local money (typed when the QR is static); the USDC cost from the quote. Confirm (signs `open_with_deposit`) → waiting for the merchant → "Did the shop get the money?" → release, or dispute. |
| Pay charge          | The business, the amount in local money and in USDC. Pay with the balance, or in pesos (the existing checkout).                                                                                                                            |
| Activity            | A list, plus a detail with a status timeline (orders, transfers, QR payments).                                                                                                                                                             |
| Me                  | Handle, address with copy, network, language, theme, install app, Pollar recovery/export where the wallet supports it, sign out.                                                                                                           |

- Desktop shows the app in a centred, phone-width column.
- Mock mode covers every screen.
- Playwright at phone viewports (Pixel 7 and iPhone 14 profiles), in es and en.

### 7.4 The rest of the web

The dashboard, the charge page and the docs move to Stellar:

- addresses and explorer links;
- XDR transactions, and SEP-10 wallet proofs;
- liquidity through `deposit` and `set_matcher`;
- offers, including the `ar_qr` and `br_pix_qr` rails;
- the merchant's order view, which shows a QR_PAY order's QR so the merchant can pay it.

The landing names Stellar instead of EVM networks.

## 8. Branches and integration

- **Integration branch `feat/stellar`:** this document plus `packages/payment-qr`.
- **Worktrees**, all branched from `feat/stellar`:

| Worktree                          | Branch                   |
| --------------------------------- | ------------------------ |
| `C:/Users/emanu/wt/pst-contracts` | `feat/stellar-contracts` |
| `C:/Users/emanu/wt/pst-api`       | `feat/stellar-api`       |
| `C:/Users/emanu/wt/pst-web`       | `feat/stellar-web`       |

- **Cross-branch merges:**
  - The API agent merges `feat/stellar-contracts` once it needs the artifact.
  - The web agent merges `feat/stellar-api` and regenerates its API types once the API's
    `openapi.json` is ready. Until then it codes against sections 5 and 7 in mock mode.
- **Rules for agents:**
  - Commit often, with conventional commits. Never push.
  - Never touch another agent's worktree, and never merge into `feat/stellar` or `main`: the
    orchestrator integrates.
  - Change dependencies only in your own workspace's `package.json`. The orchestrator resolves
    `package-lock.json` conflicts by reinstalling.
  - Keep your workspace README current. The orchestrator updates `docs/HANDOFF.md` and `AGENTS.md`.
- **Gates before reporting:** your workspaces' `build`, `typecheck`, `lint` and `test`. Say what you
  verified and what you did not.
