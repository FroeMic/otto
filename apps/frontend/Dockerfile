FROM oven/bun:1.3.5 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/features/workspace-core/package.json packages/features/workspace-core/package.json
COPY packages/features/workspace-slugs/package.json packages/features/workspace-slugs/package.json
COPY packages/auth/package.json packages/auth/package.json

RUN bun install --frozen-lockfile

COPY apps/frontend apps/frontend
COPY packages/features/workspace-core packages/features/workspace-core
COPY packages/features/workspace-slugs packages/features/workspace-slugs
COPY packages/auth packages/auth

RUN bun run --cwd apps/frontend build

FROM oven/bun:1.3.5 AS runtime

WORKDIR /app

ENV FRONTEND_PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

COPY --from=builder /app/apps/frontend/dist ./dist

EXPOSE 3000

CMD ["bun", "dist/server/index.js"]
