FROM oven/bun:1 AS bun

FROM node:20-bookworm-slim AS builder

WORKDIR /app/web
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_POSTHOG_ENABLED
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_POSTHOG_TOKEN
ENV NEXT_PUBLIC_POSTHOG_ENABLED=$NEXT_PUBLIC_POSTHOG_ENABLED
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_TOKEN=$NEXT_PUBLIC_POSTHOG_TOKEN

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx

COPY web/package.json web/package-lock.json ./
RUN npm install --no-package-lock

COPY web ./
COPY packages /app/packages

RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app/web
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx

COPY --from=builder /app/web/package.json ./package.json
COPY --from=builder /app/web/package-lock.json ./package-lock.json
COPY --from=builder /app/web/node_modules ./node_modules
COPY --from=builder /app/web/.next ./.next
COPY --from=builder /app/web/drizzle ./drizzle
COPY --from=builder /app/web/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/web/next.config.ts ./next.config.ts
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/src ./src
COPY --from=builder /app/web/ssh2-sftp-client.d.ts ./ssh2-sftp-client.d.ts
COPY --from=builder /app/web/tsconfig.json ./tsconfig.json
COPY --from=builder /app/packages /app/packages

EXPOSE 3000

CMD ["npm", "run", "start"]
