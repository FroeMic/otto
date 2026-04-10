FROM oven/bun:1.3.5 AS bun

FROM node:20-bookworm-slim AS builder

WORKDIR /app
ENV NODE_ENV=production

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
RUN bun install --frozen-lockfile --filter @otto/worker

WORKDIR /app
COPY apps/worker apps/worker

RUN bun run --cwd apps/worker build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx

COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/legacy-control-plane-runtime ./packages/legacy-control-plane-runtime

WORKDIR /app/apps/worker

CMD ["bun", "dist/index.js"]
