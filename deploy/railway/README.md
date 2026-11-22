# A hosted test market on Railway

A temporary deployment of the whole market on Stellar testnet (the `test` tier), reachable from the
internet over HTTPS: to try it on a phone, install the PWA or show it. It is apart from the local
stack: its own testnet keys, market contract, merchants and database, so `npm run dev:stack` keeps
working beside it. Testnet only, never mainnet.

| Service     | Built from                         | What it runs                                                                                                                                                                                              |
| ----------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Postgres`  | Railway's Postgres                 | the API's database                                                                                                                                                                                        |
| `api`       | `api.Dockerfile`                   | the API with its jobs (indexer, expiry, matcher, submissions, webhooks); private network only, port 4000; applies the migrations at start                                                                 |
| `web`       | `web.Dockerfile`                   | Caddy (`Caddyfile`): the app built for production, and `/v1/*` and `/.well-known/*` passed to the API, so both share the public origin (the session cookie, SEP-10's home domain); the only public domain |
| `merchants` | `api.Dockerfile`, `ROLE=merchants` | `scripts/hosted-merchants.ts`: a simulated-merchant bot per merchant (the seeded one and the three automated ones) and their offers repriced every minute                                                 |

The API runs as production (`hostedApiEnv` in `apps/api/src/dev/hosted-env.ts`): no dev tools, no
dev wallet keys, secure cookies; the sponsor's per-IP limits are raised so a room on one network
can sign up. The web is a production build: no mock mode and no dev-key wallet, sign-in goes
through Pollar only.

## Set up

Each service picks its Dockerfile with the variable `RAILWAY_DOCKERFILE_PATH`. `railway up` sends
this folder's files that git does not ignore (`.dev-stack/` and `.env*` stay here).

1. Create the project and the services:

   ```sh
   railway init --name midpoint-test
   railway add --database postgres
   railway add --service api
   railway add --service web
   railway add --service merchants
   railway domain --service web          # the public origin, https://…up.railway.app
   ```

2. The market and the API's environment (keys and state in `.dev-stack/hosted/`, gitignored):

   ```sh
   npm run build -w @midpoint/contracts -w @midpoint/payment-qr -w @midpoint/api
   npm run hosted -- init --origin https://<web domain>
   ```

   Set every line of `.dev-stack/hosted/api.env` on `api`, plus
   `RAILWAY_DOCKERFILE_PATH=deploy/railway/api.Dockerfile`.

3. On `web`: `RAILWAY_DOCKERFILE_PATH=deploy/railway/web.Dockerfile`,
   `API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:4000`, `VITE_POLLAR_PUBLISHABLE_KEY`,
   `VITE_APP_TIER=test` and `VITE_APP_TOKEN=USDC`.

4. Deploy both: `railway up --service api --detach`, `railway up --service web --detach`.

5. Once `https://<web domain>/v1/market?tier=test` answers, seed through it (a few minutes on
   testnet; a rerun resumes): `npm run hosted -- seed`. Set every line of
   `.dev-stack/hosted/merchants.env` on `merchants`, plus
   `MIDPOINT_API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000` and
   `RAILWAY_DOCKERFILE_PATH=deploy/railway/api.Dockerfile`, then
   `railway up --service merchants --detach`.

6. In Pollar's dashboard, allow the web origin (Developers > Websites: allowed origins and
   redirect URIs), or the Google sign-in is refused.

A new version: `railway up --service <name>` again. To take it all down, delete the project in
Railway's dashboard; the testnet keys in `.dev-stack/hosted/` can then be deleted too.
