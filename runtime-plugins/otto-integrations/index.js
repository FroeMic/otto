import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_TIMEOUT_MS = 15_000;

export default definePluginEntry({
  id: "otto-integrations",
  name: "Otto Integrations",
  description: "Managed integration tools backed by the workspace app.",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      timeoutMs: {
        type: "integer",
        minimum: 1000,
      },
      manifest: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  },
  register(api) {
    for (const integration of resolveManifest(api)) {
      api.registerTool(
        {
          name: integration.toolName,
          description: integration.toolDescription,
          parameters: integration.parametersSchema,
          async execute(_id, params) {
            return buildToolResult(
              await executeIntegration(api, integration.key, params),
            );
          },
        },
        { optional: true },
      );
    }
  },
});

function buildToolResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

async function executeIntegration(api, integrationKey, params) {
  const response = await requestControlPlane(api, {
    method: "POST",
    path: "/api/internal/runtime/integrations/execute",
    body: {
      integrationKey,
      params,
    },
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    result: response.data,
  };
}

function resolveManifest(api) {
  const manifest = Array.isArray(api?.config?.manifest)
    ? api.config.manifest
    : [];

  return manifest
    .filter((entry) => isManifestEntry(entry))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function isManifestEntry(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.key === "string" &&
    typeof value.toolName === "string" &&
    typeof value.toolDescription === "string" &&
    value.parametersSchema &&
    typeof value.parametersSchema === "object"
  );
}

function resolveControlPlaneBaseUrl() {
  const raw = process.env.OTTO_CONTROL_PLANE_BASE_URL ?? "";
  const value = raw.trim().replace(/\/+$/, "");
  return value || null;
}

function resolveTenantToken() {
  const raw = process.env.TENANT_TOKEN ?? "";
  const value = raw.trim();
  return value || null;
}

function resolveTimeoutMs(api) {
  const configured = api?.config?.timeoutMs;

  if (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured >= 1000
  ) {
    return configured;
  }

  return DEFAULT_TIMEOUT_MS;
}

async function requestControlPlane(api, input) {
  const baseUrl = resolveControlPlaneBaseUrl();
  const token = resolveTenantToken();
  const timeoutMs = resolveTimeoutMs(api);

  if (!baseUrl) {
    return {
      ok: false,
      code: "control_plane_env_missing",
      error:
        "OTTO_CONTROL_PLANE_BASE_URL is not set in the runtime environment.",
    };
  }

  if (!token) {
    return {
      ok: false,
      code: "control_plane_env_missing",
      error: "TENANT_TOKEN is not set in the runtime environment.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${input.path}`, {
      body: input.body ? JSON.stringify(input.body) : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(input.body
          ? {
              "Content-Type": "application/json",
            }
          : {}),
      },
      method: input.method,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return {
        ok: false,
        code:
          typeof data?.code === "string"
            ? data.code
            : "integration_request_failed",
        error:
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : `${input.method} ${input.path} failed with ${response.status}.`,
        status: response.status,
      };
    }

    return {
      ok: true,
      data,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        code: "integration_request_timeout",
        error: `${input.method} ${input.path} timed out after ${timeoutMs}ms while calling the workspace app.`,
      };
    }

    return {
      ok: false,
      code: "integration_request_failed",
      error:
        error instanceof Error
          ? error.message
          : "Managed integration request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
