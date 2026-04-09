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
COPY packages/legacy-control-plane-runtime/package.json packages/legacy-control-plane-runtime/package.json
COPY packages/features/runtime-core/package.json packages/features/runtime-core/package.json
COPY packages/features/workspace-core/package.json packages/features/workspace-core/package.json
COPY packages/features/workspace-slugs/package.json packages/features/workspace-slugs/package.json
RUN bun install --frozen-lockfile

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm install --no-package-lock

WORKDIR /app
COPY apps/api apps/api
COPY packages/auth packages/auth
COPY packages/features/runtime-core packages/features/runtime-core
COPY packages/features/workspace-core packages/features/workspace-core
COPY packages/features/workspace-slugs packages/features/workspace-slugs
COPY web/src web/src
COPY web/tsconfig.json web/tsconfig.json

RUN bun run --cwd apps/api build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV API_PORT=3002
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/web/node_modules ./web/node_modules
COPY --from=builder /app/web/package.json ./web/package.json
COPY --from=builder /app/web/package-lock.json ./web/package-lock.json
COPY --from=builder /app/web/src ./web/src
COPY --from=builder /app/web/tsconfig.json ./web/tsconfig.json

EXPOSE 3002

WORKDIR /app/apps/api

CMD ["bun", "dist/index.js"]
