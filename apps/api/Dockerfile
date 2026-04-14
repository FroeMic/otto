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
# Bun frozen workspace installs need the workspace manifests present, but not
# the full package sources. Copying only manifests keeps source edits from
# invalidating the install cache layer.
COPY packages/auth/package.json packages/auth/package.json
COPY packages/features/billing/package.json packages/features/billing/package.json
COPY packages/features/integrations-runtime/package.json packages/features/integrations-runtime/package.json
COPY packages/features/platform/package.json packages/features/platform/package.json
COPY packages/features/runtime-core/package.json packages/features/runtime-core/package.json
COPY packages/features/user-profile/package.json packages/features/user-profile/package.json
COPY packages/features/workspace-chat/package.json packages/features/workspace-chat/package.json
COPY packages/features/workspace-core/package.json packages/features/workspace-core/package.json
COPY packages/features/workspace-members/package.json packages/features/workspace-members/package.json
COPY packages/features/workspace-onboarding/package.json packages/features/workspace-onboarding/package.json
COPY packages/features/workspace-slugs/package.json packages/features/workspace-slugs/package.json
RUN bun install --frozen-lockfile --filter @otto/api

WORKDIR /app
COPY packages packages
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
