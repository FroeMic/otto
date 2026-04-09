FROM oven/bun:1.3.5 AS builder

WORKDIR /app

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

RUN bun install --frozen-lockfile --filter @otto/web

COPY apps/web apps/web
COPY packages/features/workspace-core packages/features/workspace-core
COPY packages/features/workspace-slugs packages/features/workspace-slugs
COPY packages/auth packages/auth

RUN bun run --cwd apps/web build

FROM oven/bun:1.3.5 AS runtime

WORKDIR /app

ENV FRONTEND_PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/dist ./dist

EXPOSE 3000

CMD ["bun", "dist/server/index.js"]
