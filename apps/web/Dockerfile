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
# web and API workspace dependencies available during typecheck/build.
COPY packages packages
RUN bun install --frozen-lockfile --filter @otto/web --filter @otto/api

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
