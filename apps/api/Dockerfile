FROM oven/bun:1.3.5 AS builder

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/worker/package.json apps/worker/package.json
# Bun frozen workspace installs need the sibling workspace manifests present,
# even when we only install the filtered API workspace.
COPY packages packages
RUN bun install --frozen-lockfile --filter @otto/api

WORKDIR /app
COPY apps/api apps/api

RUN bun run --cwd apps/api build

FROM oven/bun:1.3.5 AS runtime

WORKDIR /app
ENV API_PORT=3002
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3002

WORKDIR /app/apps/api

CMD ["bun", "dist/index.js"]
