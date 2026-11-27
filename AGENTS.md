# Midpoint: agent and contributor guide

Midpoint is a Bolivian peer-to-peer market for stablecoins (USDC) against local money (bank
transfers in bolivianos first, PIX, Peru's and Argentina's interoperable QRs...) on **Stellar**,
with a public API, and a simple payments app on top of it (an installable PWA at `/app`). A user
types an amount; the matching service picks a merchant (no ads book). Merchants keep liquidity in a Soroban contract; the contract locks each
order's tokens until the party receiving the local money releases them. Users never pay network
fees: the API fee-bumps their transactions.

**Start here: [`docs/HANDOFF.md`](docs/HANDOFF.md)**: the project's history, current state, how to
run the local test server, the design and security invariants, open decisions and the backlog.
Keep it current when a session changes any of those. The design contract of the Stellar port and
the app is [`docs/STELLAR.md`](docs/STELLAR.md).

The product is **Midpoint** (renamed from "pedospe" on 2026-11-20). Keep the display name in its
one place per workspace (web `src/lib/brand.ts`, API `BRAND_NAME`), never spread it through copy.
Technical names (`@midpoint/*` packages, `Midpoint-*` headers, `MIDPOINT_*` variables, storage
keys) are part of the API contract.

## Layout (npm workspaces)

| Path                  | What                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`  | the Soroban `P2PMarket` contract (Rust), its committed artifact (wasm + spec as TypeScript) and its tests                                                                        |
| `packages/payment-qr` | reads what the app scans or pastes: Stellar addresses, SEP-7, the app's payment and charge links, handles, EMVCo merchant QRs (PE, PIX, AR interoperable)                        |
| `apps/api`            | the public API (NestJS + Prisma + Postgres): accounts, offers, matching, orders, charges, payouts, webhooks, the app's routes, sponsored submission, the indexer and the matcher |
| `apps/web`            | the web: the payments app (`/app`), the merchant dashboard, the hosted charge page, the docs and the landing                                                                     |
| `packages/sdk`        | TypeScript client for the API, webhook verification and a reference merchant bot                                                                                                 |

## Non-negotiables

- **Non-custodial.** The server never holds a key that can move anyone's tokens. Its keys are the
  matcher's (opens orders within each seller's cap, acts for buyers), the sponsor's (pays fees and
  activation reserves, holds only XLM) and the SEP-10 signer's (signs auth challenges, never
  funded). Owner and arbiter keys live in external multisigs; the API only builds unsigned
  transactions for them.
- **The contract is the boundary.** Server-side checks spare users refused transactions; they never
  replace a check in the contract. Changing the contract means a new artifact, new tests and a new
  deployment.
- **The web checks before every signature.** Any transaction the API builds is decoded and every
  field pinned to a trusted source before the wallet signs (`apps/web/src/lib/p2p/tx-verify.ts`);
  a missing expectation is a refusal.
- **Never commit a secret.** Deploy scripts and the dev stack read keys from outside the repo
  (`.dev-stack/` is gitignored).

## Conventions

- **Imports: always the `@/` alias, never relative paths** (`./x`, `../x`). Each package's `@/`
  points to its own `src/`. Across packages, import by package name (`@midpoint/contracts`), never
  with `../`. Configure the alias in every tool of the package (tsconfig `paths`, Vite/Vitest,
  bundler, runtime). A package consumed by others exposes built output (`dist/`) through `exports`,
  so its own `@/` never leaks into a consumer.
- **Everything technical is in English**: code, identifiers, comments, logs, errors, CLI messages,
  commits, PRs, READMEs, this file.
- **The UI ships in Spanish, English and Brazilian Portuguese** through translation files
  (`apps/web/src/i18n/messages/{es,en,pt}`); no user-facing string is hard-coded. Spanish is the
  source and the default; every other catalog mirrors it key for key.
- **Tests ship with the change.** A new rule, service or route gets its tests in the same commit.
- Conventional commits (`feat(api): ...`, `fix(contracts): ...`).

## Commands

| Command                                  | What it does                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm install`                            | installs every workspace                                                                                              |
| `npm run build`                          | builds every workspace (contracts and payment-qr first)                                                               |
| `npm test`                               | every workspace's tests (the contract's `cargo test` included)                                                        |
| `npm run typecheck`                      | every workspace's type check                                                                                          |
| `npm run lint`                           | ESLint + Prettier everywhere, `cargo fmt --check` + `clippy -D warnings` for the contract                             |
| `npm run compile -w @midpoint/contracts` | rebuilds the release wasm into `src/p2p-market.artifact.ts` (the artifact test fails if source and artifact disagree) |
| `npm run dev:stack -- --testnet`         | the whole market locally on Stellar testnet (section 4 of the handoff)                                                |
| `npm run dev:mock -w @midpoint/web`      | the whole web with an in-browser mock API and a demo wallet                                                           |

Before finishing a task: run the type check, lint and tests of every workspace you touched, and say
what was verified and what was not.
