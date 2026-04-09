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
  description:
    "Managed integration tools backed by the workspace app. This is the supported path for managed integrations such as Slack and Linear. Recommended workflow: use find_integration_commands when you know the user's goal but not the exact integration command, use list_integrations when you need deterministic workspace inventory, use get_integration to inspect top-level command groups and settings guidance, use get_integration_details to inspect one command or command group in detail, use configure_integration for safe provider-owned settings, use manage_integration for connect or reconnect actions, then execute with execute_integration_command using integrationKey plus commandKey or commandPath.",
  configSchema: PLUGIN_CONFIG_SCHEMA,
  register(api) {
    api.registerTool(
      {
        name: "find_integration_commands",
        description:
          "Find the best Otto-managed integration commands for a user request. Use this first when you know the user's goal but not the exact integration or command key. The result is a compact ranked candidate list with integration keys, command keys, connection state, a match reason, and example arguments. After choosing a candidate, call get_integration or get_integration_details before execution.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 50,
            },
            query: {
              type: "string",
              minLength: 1,
            },
            scope: {
              type: "string",
              enum: ["installed", "available", "all"],
            },
          },
          required: ["query"],
        },
        async execute(_id, params) {
          return buildToolResult(await findIntegrationCommands(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "list_integrations",
        description:
          "List Otto-managed integrations available to this runtime. Use scope=installed by default to inspect integrations already present in the workspace. Use scope=available or scope=all when you want the broader catalog rather than only installed integrations.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            scope: {
              type: "string",
              enum: ["installed", "available", "all"],
            },
          },
        },
        async execute(_id, params) {
          return buildToolResult(await listIntegrations(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "get_integration",
        description:
          "Read one Otto-managed integration summary, including connection state, top-level command groups, root commands, and the recommended discovery workflow. Use this when you know the integration but do not want the full schema for every command.",
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
            await getIntegration(api, normalizeString(params.integrationKey)),
          );
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "get_integration_details",
        description:
          "Read one command group or one command in detail for an Otto-managed integration. Use detailType=command_group to browse one group slice. Use detailType=command to fetch the full argumentsSchema, usage notes, and example call for a specific command before execution.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            detailKey: {
              type: "string",
              minLength: 1,
            },
            detailType: {
              type: "string",
              enum: ["command_group", "command"],
            },
            integrationKey: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["detailKey", "detailType", "integrationKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await getIntegrationDetails(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "configure_integration",
        description:
          "Read, validate, or apply safe provider-owned settings for an Otto-managed integration. This is the supported path for managed integration settings such as Slack and Linear. Use action=get first to inspect current settings, editable fields, patch schema, and example updates. Then use action=validate to dry-run a patch and action=apply to persist a patch with expectedEntryVersion from a prior read.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: {
              type: "string",
              enum: ["apply", "get", "validate"],
            },
            expectedEntryVersion: {
              type: "integer",
              minimum: 1,
            },
            integrationKey: {
              type: "string",
              minLength: 1,
            },
            patch: {
              type: "object",
              additionalProperties: true,
            },
            summary: {
              type: "string",
              minLength: 1,
              maxLength: 500,
            },
          },
          required: ["integrationKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await configureIntegration(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "manage_integration",
        description:
          "Get the right workspace URL and recommended next action to connect, reconnect, disconnect, or review an Otto-managed integration. Use this for lifecycle changes and browser handoff flows, not for settings updates. After confirming an integration is connected, say that plainly and offer to help the user connect or review other integrations available in the workspace by using list_integrations when useful.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: {
              type: "string",
              enum: ["connect", "disconnect", "open_workspace", "reconnect"],
            },
            integrationKey: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["integrationKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await manageIntegration(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "execute_integration_command",
        description:
          "Execute one command on an Otto-managed integration through the workspace app. Use commandKey values returned by find_integration_commands or get_integration_details. Pass command-specific inputs in arguments. Example: {\"integrationKey\":\"linear\",\"commandKey\":\"issue.search\",\"arguments\":{\"query\":\"credit\",\"limit\":5}}",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            arguments: {
              type: "object",
              additionalProperties: true,
            },
            commandKey: {
              type: "string",
              minLength: 1,
            },
            commandPath: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
              },
              minItems: 1,
            },
            integrationKey: {
              type: "string",
              minLength: 1,
            },
            params: {
              type: "object",
              additionalProperties: true,
            },
          },
          required: ["integrationKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await executeIntegrationCommand(api, params));
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

async function listIntegrations(api, params) {
  const scope = normalizeScope(params.scope);
  const response = await requestControlPlane(api, {
    method: "GET",
    path: `/api/internal/runtime/integrations?scope=${encodeURIComponent(scope)}`,
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] list failed scope=${scope} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] list succeeded scope=${scope} count=${Array.isArray(response.data?.integrations) ? response.data.integrations.length : 0}`,
  );

  return response.data;
}

async function findIntegrationCommands(api, params) {
  const query = normalizeString(params.query);
  const scope = normalizeScope(params.scope);
  const limit = normalizePositiveInteger(params.limit, 10);
  const response = await requestControlPlane(api, {
    method: "POST",
    path: "/api/internal/runtime/integrations/find",
    body: {
      limit,
      query,
      scope,
    },
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] find failed query=${JSON.stringify(query)} scope=${scope} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] find succeeded query=${JSON.stringify(query)} scope=${scope} matches=${Array.isArray(response.data?.matches) ? response.data.matches.length : 0}`,
  );

  if (
    Array.isArray(response.data?.matches) &&
    Number.isInteger(limit) &&
    response.data.matches.length > limit
  ) {
    return {
      ...response.data,
      matches: response.data.matches.slice(0, limit),
    };
  }

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

async function getIntegrationDetails(api, params) {
  const integrationKey = normalizeString(params.integrationKey);
  const detailType =
    params.detailType === "command" || params.detailType === "command_group"
      ? params.detailType
      : "";
  const detailKey = normalizeString(params.detailKey);
  const response = await requestControlPlane(api, {
    method: "POST",
    path: `${buildIntegrationDetailPath(integrationKey)}/details`,
    body: {
      detailKey,
      detailType,
    },
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] get-details failed integration=${integrationKey} detailType=${detailType || "unknown"} detailKey=${detailKey || "unknown"} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] get-details succeeded integration=${integrationKey} detailType=${detailType} detailKey=${detailKey}`,
  );

  return response.data;
}

async function configureIntegration(api, params) {
  const integrationKey = normalizeString(params.integrationKey);
  const action = normalizeSettingsAction(params.action);
  const patch =
    params.patch && typeof params.patch === "object" && !Array.isArray(params.patch)
      ? params.patch
      : null;
  const expectedEntryVersion =
    typeof params.expectedEntryVersion === "number" &&
    Number.isInteger(params.expectedEntryVersion) &&
    params.expectedEntryVersion >= 1
      ? params.expectedEntryVersion
      : null;
  const summary =
    typeof params.summary === "string" ? params.summary.trim() : "";
  const path = `${buildIntegrationDetailPath(integrationKey)}/settings`;

  if (action === "get") {
    const response = await requestControlPlane(api, {
      method: "GET",
      path,
    });

    if (!response.ok) {
      console.warn(
        `[otto-integrations] configure-get failed integration=${integrationKey} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
      );
      return response;
    }

    console.info(
      `[otto-integrations] configure-get succeeded integration=${integrationKey}`,
    );

    return response.data;
  }

  if (!patch) {
    return {
      ok: false,
      error: "patch must be an object for validate and apply actions.",
    };
  }

  if (action === "apply" && !expectedEntryVersion) {
    return {
      ok: false,
      error:
        "expectedEntryVersion is required for apply and must come from a prior configure_integration action=get call.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path,
    body: {
      action,
      expectedEntryVersion: expectedEntryVersion ?? undefined,
      patch,
      ...(summary ? { summary } : {}),
    },
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] configure-${action} failed integration=${integrationKey} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] configure-${action} succeeded integration=${integrationKey}`,
  );

  return response.data;
}

async function manageIntegration(api, params) {
  const integrationKey = normalizeString(params.integrationKey);
  const action = normalizeString(params.action);
  const response = await requestControlPlane(api, {
    method: "POST",
    path: `${buildIntegrationDetailPath(integrationKey)}/connection`,
    body: action ? { action } : {},
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] manage failed integration=${integrationKey} action=${action || "auto"} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  const selectedAction =
    response.data?.connectionAction?.selectedAction || action || "auto";

  console.info(
    `[otto-integrations] manage succeeded integration=${integrationKey} action=${selectedAction}`,
  );

  return response.data;
}

async function executeIntegrationCommand(api, params) {
  const integrationKey = normalizeString(params.integrationKey);
  const commandKey = normalizeString(params.commandKey);
  const commandPath = Array.isArray(params.commandPath)
    ? params.commandPath
        .map((entry) => normalizeString(entry))
        .filter(Boolean)
    : [];
  const argumentsObject =
    params.arguments &&
    typeof params.arguments === "object" &&
    !Array.isArray(params.arguments)
      ? params.arguments
      : params.params &&
          typeof params.params === "object" &&
          !Array.isArray(params.params)
        ? params.params
        : {};

  const response = await requestControlPlane(api, {
    method: "POST",
    path: "/api/internal/runtime/integrations/execute",
    body: {
      arguments: argumentsObject,
      ...(commandKey ? { commandKey } : {}),
      ...(commandPath.length > 0 ? { commandPath } : {}),
      integrationKey,
    },
  });

  if (!response.ok) {
    console.warn(
      `[otto-integrations] execute failed integration=${integrationKey} command=${commandKey || commandPath.join(".") || "unknown"} code=${response.code ?? "unknown"} status=${response.status ?? "n/a"} error=${response.error ?? "unknown"}`,
    );
    return response;
  }

  console.info(
    `[otto-integrations] execute succeeded integration=${integrationKey} command=${commandKey || commandPath.join(".")}`,
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

function normalizeScope(value) {
  return value === "available" || value === "all" ? value : "installed";
}

function normalizeSettingsAction(value) {
  return value === "apply" || value === "validate" ? value : "get";
}

function normalizePositiveInteger(value, fallback) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 50
    ? value
    : fallback;
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
