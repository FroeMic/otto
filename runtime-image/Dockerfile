ARG OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:latest

FROM ${OPENCLAW_BASE_IMAGE}

USER root

COPY --chown=node:node runtime-plugins/otto-managed-config /app/extensions/otto-managed-config

RUN find /app/extensions/otto-managed-config -type d -exec chmod 755 {} + \
 && find /app/extensions/otto-managed-config -type f -exec chmod 644 {} +

USER node
