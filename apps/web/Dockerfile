FROM oven/bun:1.3.5 AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/worker/package.json apps/worker/package.json
# The web build imports the API Hono RPC type surface, so the builder needs the
# workspace manifests for both app and package dependencies during install.
# Copy manifests only so source edits do not bust the install cache layer.
COPY packages/auth/package.json packages/auth/package.json
COPY packages/features/billing/package.json packages/features/billing/package.json
COPY packages/features/integrations-runtime/package.json packages/features/integrations-runtime/package.json
COPY packages/features/platform/package.json packages/features/platform/package.json
COPY packages/features/runtime-core/package.json packages/features/runtime-core/package.json
COPY packages/features/user-profile/package.json packages/features/user-profile/package.json
COPY packages/features/workspace-chat/package.json packages/features/workspace-chat/package.json
COPY packages/features/workspace-core/package.json packages/features/workspace-core/package.json
COPY packages/features/workspace-members/package.json packages/features/workspace-members/package.json
COPY packages/features/workspace-slugs/package.json packages/features/workspace-slugs/package.json
RUN bun install --frozen-lockfile --filter @otto/web --filter @otto/api

COPY packages packages
COPY apps/api apps/api
COPY apps/web apps/web

RUN bun run --cwd apps/web build

FROM oven/bun:1.3.5 AS runtime

WORKDIR /app

ENV FRONTEND_PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/dist ./dist

EXPOSE 3000

CMD ["bun", "dist/server/index.js"]
