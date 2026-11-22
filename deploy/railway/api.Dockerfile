# The API and the automated merchants of a hosted test market (deploy/railway/README.md). One image;
# ROLE picks the process: `api` (the default) applies the database migrations and serves,
# `merchants` runs the simulated merchants (scripts/hosted-merchants.ts). Built from the repository
# root. The dev dependencies stay: the Prisma CLI applies the migrations at start.
FROM node:24-bookworm-slim
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund \
  && npm run build -w @midpoint/contracts -w @midpoint/payment-qr -w @midpoint/sdk -w @midpoint/api
ENV NODE_ENV=production
CMD ["sh", "-c", "if [ \"$ROLE\" = merchants ]; then exec node scripts/hosted-merchants.ts; else cd apps/api && npx prisma migrate deploy && exec node dist/main.js; fi"]
