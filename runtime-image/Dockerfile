ARG OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.4.8

FROM ${OPENCLAW_BASE_IMAGE}

USER root

COPY --chown=node:node runtime-plugins/otto-managed-config /app/extensions/otto-managed-config
COPY --chown=node:node runtime-plugins/otto-runtime-config /app/extensions/otto-runtime-config
COPY --chown=node:node runtime-plugins/otto-integrations /app/extensions/otto-integrations
COPY --chown=node:node runtime-plugins/otto-session-reporter /app/extensions/otto-session-reporter
COPY --chown=node:node runtime-plugins/otto-ai-provider /app/extensions/otto-ai-provider
COPY --chown=node:node runtime-image/helpers /app/otto-helpers

RUN find /app/extensions/otto-managed-config -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-managed-config -type f -exec chmod 644 {} + \
 && find /app/extensions/otto-runtime-config -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-runtime-config -type f -exec chmod 644 {} + \
 && find /app/extensions/otto-integrations -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-integrations -type f -exec chmod 644 {} + \
 && find /app/extensions/otto-session-reporter -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-session-reporter -type f -exec chmod 644 {} + \
 && find /app/extensions/otto-ai-provider -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-ai-provider -type f -exec chmod 644 {} + \
 && find /app/otto-helpers -type d -exec chmod 755 {} + \
 && find /app/otto-helpers -type f -exec chmod 755 {} +

ENV OPENCLAW_NO_RESPAWN=1
ENV NODE_COMPILE_CACHE=/home/node/.openclaw/.cache/node-compile

USER node
