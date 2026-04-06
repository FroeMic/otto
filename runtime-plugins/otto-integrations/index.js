import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_TIMEOUT_MS = 15_000;
const PLUGIN_CONFIG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    timeoutMs: {
      type: "integer",
      minimum: 1000,
    },
  },
};

export default definePluginEntry({
  id: "otto-integrations",
  name: "Otto Integrations",
  description: "Managed integration tools backed by the workspace app.",
  configSchema: PLUGIN_CONFIG_SCHEMA,
  register(api) {
    console.info(
      "[otto-integrations] register staticTools=list_integrations,get_integration,get_integration_status,execute_integration_function",
    );

    api.registerTool(
      {
        name: "list_integrations",
        description:
          "List Otto-managed integrations available to this runtime, including capability summaries and connection state.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
        async execute() {
          return buildToolResult(await listIntegrations(api));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "get_integration",
        description:
          "Read one Otto-managed integration, including its available functions, parameter schema, and current connection state.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            integrationKey: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["integrationKey"],
        },
        async execute(_id, params) {
          return buildToolResult(
            await getIntegration(api, params.integrationKey),
          );
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "get_integration_status",
        description:
          "Read just the current connection and enablement status for one Otto-managed integration.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            integrationKey: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["integrationKey"],
        },
        async execute(_id, params) {
          return buildToolResult(
            await getIntegrationStatus(api, params.integrationKey),
          );
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "execute_integration_function",
        description:
          "Execute one function on an Otto-managed integration through the workspace app.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            arguments: {
              type: "object",
              additionalProperties: true,
            },
            functionKey: {
              type: "string",
              minLength: 1,
            },
            integrationKey: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["functionKey", "integrationKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await executeIntegrationFunction(api, params));
        },
      },
      { optional: true },
    );
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

async function listIntegrations(api) {
  const response = await requestControlPlane(api, {
    method: "GET",
    path: "/api/internal/runtime/integrations",
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] list failed code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] list succeeded count=${Array.isArray(response.data?.integrations) ? response.data.integrations.length : 0}`,
  );

  return response.data;
}

async function getIntegration(api, integrationKey) {
  const response = await requestControlPlane(api, {
    method: "GET",
    path: buildIntegrationDetailPath(integrationKey),
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] get failed integration=${integrationKey} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] get succeeded integration=${integrationKey}`,
  );

  return response.data;
}

async function getIntegrationStatus(api, integrationKey) {
  const detail = await getIntegration(api, integrationKey);

  if (!detail?.integration) {
    return detail;
  }

  return {
    integrationKey: detail.integration.key,
    label: detail.integration.label,
    status: detail.integration.status,
  };
}

async function executeIntegrationFunction(api, params) {
  const integrationKey = normalizeString(params.integrationKey);
  const functionKey = normalizeString(params.functionKey);
  const argumentsObject =
    params.arguments &&
    typeof params.arguments === "object" &&
    !Array.isArray(params.arguments)
      ? params.arguments
      : {};

  const response = await requestControlPlane(api, {
    method: "POST",
    path: "/api/internal/runtime/integrations/execute",
    body: {
      integrationKey,
      params: {
        ...argumentsObject,
        operation: functionKey,
      },
    },
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] execute failed integration=${integrationKey} function=${functionKey} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] execute succeeded integration=${integrationKey} function=${functionKey}`,
  );

  return {
    ok: true,
    result: response.data,
  };
}

function buildIntegrationDetailPath(integrationKey) {
  return `/api/internal/runtime/integrations/${encodeURIComponent(integrationKey)}`;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
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
