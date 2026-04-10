FROM oven/bun:1.3.5 AS builder

WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
# Bun frozen workspace installs need the sibling workspace manifests present,
# even when we only install the filtered gateway workspace.
COPY packages packages
RUN bun install --frozen-lockfile --filter @otto/gateway

WORKDIR /app
COPY apps/gateway apps/gateway

RUN bun run --cwd apps/gateway build

FROM oven/bun:1.3.5 AS runtime

WORKDIR /app
ENV HOSTNAME=0.0.0.0
ENV INTEGRATION_GATEWAY_PORT=3001
ENV NODE_ENV=production

COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

WORKDIR /app/apps/gateway

CMD ["bun", "dist/index.js"]
