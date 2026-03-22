ARG OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.3.13-1

FROM ${OPENCLAW_BASE_IMAGE}

USER root

COPY --chown=node:node runtime-plugins/otto-managed-config /app/extensions/otto-managed-config
COPY --chown=node:node runtime-plugins/otto-runtime-config /app/extensions/otto-runtime-config
COPY --chown=node:node runtime-image/helpers /app/otto-helpers

RUN find /app/extensions/otto-managed-config -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-managed-config -type f -exec chmod 644 {} + \
 && find /app/extensions/otto-runtime-config -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-runtime-config -type f -exec chmod 644 {} + \
 && find /app/otto-helpers -type d -exec chmod 755 {} + \
 && find /app/otto-helpers -type f -exec chmod 755 {} +

USER node
