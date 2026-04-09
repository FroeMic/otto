FROM oven/bun:1 AS bun

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
COPY packages/auth/package.json packages/auth/package.json
COPY packages/features/integrations-runtime/package.json packages/features/integrations-runtime/package.json
COPY packages/legacy-control-plane-runtime/package.json packages/legacy-control-plane-runtime/package.json
COPY packages/features/runtime-core/package.json packages/features/runtime-core/package.json
COPY packages/features/workspace-core/package.json packages/features/workspace-core/package.json
COPY packages/features/workspace-slugs/package.json packages/features/workspace-slugs/package.json
RUN bun install --frozen-lockfile

WORKDIR /app
COPY apps/worker apps/worker
COPY packages/legacy-control-plane-runtime packages/legacy-control-plane-runtime

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
