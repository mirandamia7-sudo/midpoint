# The web of a hosted test market (deploy/railway/README.md): the app built for production and served
# by Caddy, which passes /v1/* and /.well-known/* to the API over the private network, so the app
# and the API share one origin (the session cookie, SEP-10's home domain). Built from the
# repository root.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY . .
# Read by Vite at build time (the platform passes the service's variables of these names).
ARG VITE_POLLAR_PUBLISHABLE_KEY
ARG VITE_APP_TIER=test
ARG VITE_APP_TOKEN=USDC
RUN npm ci --no-audit --no-fund \
  && npm run build -w @midpoint/contracts -w @midpoint/payment-qr -w @midpoint/web

FROM caddy:2-alpine
COPY deploy/railway/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
