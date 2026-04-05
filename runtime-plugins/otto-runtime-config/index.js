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
  id: "otto-runtime-config",
  name: "Otto Runtime Config",
  description:
    "Runtime surface configuration and lifecycle tools backed by the workspace app.",
  configSchema: PLUGIN_CONFIG_SCHEMA,
  register(api) {
    api.registerTool(
      {
        name: "list_configurable_surfaces",
        description:
          "List the runtime surfaces Otto exposes through the workspace app, including current lifecycle state and allowed actions.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
        async execute() {
          return buildToolResult(await listConfigurableTools(api));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "get_configurable_surface",
        description:
          "Read one configurable runtime surface, including its current config, field meanings, options, and allowed actions.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            surfaceKey: {
              type: "string",
              minLength: 1,
            },
            surfaceKind: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["surfaceKind", "surfaceKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await getConfigurableTool(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "get_slack_policy",
        description:
          "Read Otto's current Slack policy, including derived reachability effects and the semantic operations agents should use instead of raw patch updates.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
        async execute() {
          return buildToolResult(await getSlackPolicy(api));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "preview_slack_policy_action",
        description:
          "Preview a semantic Slack policy action before applying it. Use this instead of validate_surface_change for Slack.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: {
              type: "object",
              additionalProperties: false,
              properties: {
                channelIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                },
                type: {
                  type: "string",
                  enum: [
                    "add_allowed_users",
                    "remove_allowed_users",
                    "add_allowed_channels",
                    "remove_allowed_channels",
                    "set_channel_access_mode",
                    "set_answer_in_threads",
                    "set_require_mentions",
                    "set_ack_reaction",
                  ],
                },
                userIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                },
                value: {
                  anyOf: [
                    { type: "boolean" },
                    {
                      type: "string",
                      enum: ["manual_allowlist", "member_of_channels"],
                    },
                  ],
                },
              },
              required: ["type"],
            },
          },
          required: ["action"],
        },
        async execute(_id, params) {
          return buildToolResult(await previewSlackPolicyAction(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "apply_slack_policy_action",
        description:
          "Apply a semantic Slack policy action through the workspace app. Use this instead of apply_surface_change for Slack.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: {
              type: "object",
              additionalProperties: false,
              properties: {
                channelIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                },
                type: {
                  type: "string",
                  enum: [
                    "add_allowed_users",
                    "remove_allowed_users",
                    "add_allowed_channels",
                    "remove_allowed_channels",
                    "set_channel_access_mode",
                    "set_answer_in_threads",
                    "set_require_mentions",
                    "set_ack_reaction",
                  ],
                },
                userIds: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                },
                value: {
                  anyOf: [
                    { type: "boolean" },
                    {
                      type: "string",
                      enum: ["manual_allowlist", "member_of_channels"],
                    },
                  ],
                },
              },
              required: ["type"],
            },
            expectedEntryVersion: {
              type: "integer",
              minimum: 1,
            },
            summary: {
              type: "string",
              minLength: 1,
              maxLength: 500,
            },
          },
          required: ["action", "expectedEntryVersion"],
        },
        async execute(_id, params) {
          return buildToolResult(await applySlackPolicyAction(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "validate_surface_change",
        description:
          "Dry-run validation for a runtime surface config patch without persisting it.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            patch: {
              type: "object",
              additionalProperties: true,
            },
            surfaceKey: {
              type: "string",
              minLength: 1,
            },
            surfaceKind: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["patch", "surfaceKind", "surfaceKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await validateToolChange(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "apply_surface_change",
        description:
          "Apply a validated config patch to a runtime surface through the workspace app.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            expectedEntryVersion: {
              type: "integer",
              minimum: 1,
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
            surfaceKey: {
              type: "string",
              minLength: 1,
            },
            surfaceKind: {
              type: "string",
              minLength: 1,
            },
          },
          required: [
            "expectedEntryVersion",
            "patch",
            "surfaceKind",
            "surfaceKey",
          ],
        },
        async execute(_id, params) {
          return buildToolResult(await applyToolChange(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "set_surface_state",
        description:
          "Install, uninstall, enable, or disable a configurable runtime surface. To enable or disable, pass the current installState plus the desired enabled value.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: {
              type: "boolean",
            },
            expectedEntryVersion: {
              type: "integer",
              minimum: 1,
            },
            installState: {
              type: "string",
              enum: ["installed", "uninstalled"],
            },
            summary: {
              type: "string",
              minLength: 1,
              maxLength: 500,
            },
            surfaceKey: {
              type: "string",
              minLength: 1,
            },
            surfaceKind: {
              type: "string",
              minLength: 1,
            },
          },
          required: [
            "expectedEntryVersion",
            "installState",
            "surfaceKind",
            "surfaceKey",
          ],
        },
        async execute(_id, params) {
          return buildToolResult(await setToolInstallState(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "reapply_surface",
        description:
          "Re-run desired-state compilation and queue a tenant apply for a runtime surface without changing its saved config.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: {
              type: "string",
              minLength: 1,
              maxLength: 500,
            },
            surfaceKey: {
              type: "string",
              minLength: 1,
            },
            surfaceKind: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["surfaceKind", "surfaceKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await reapplyTool(api, params));
        },
      },
      { optional: true },
    );
  },
});

async function listConfigurableTools(api) {
  const response = await requestControlPlane(api, {
    method: "GET",
    path: "/api/internal/runtime/surfaces",
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    surfaces: response.data.surfaces,
  };
}

async function getConfigurableTool(api, params) {
  const surface = normalizeSurface(params);

  if (!surface) {
    return {
      ok: false,
      error: "surfaceKind and surfaceKey must be non-empty strings.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "GET",
    path: `/api/internal/runtime/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}`,
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    surface: response.data,
  };
}

async function getSlackPolicy(api) {
  return await getConfigurableTool(api, {
    surfaceKey: "slack",
    surfaceKind: "channel",
  });
}

async function validateToolChange(api, params) {
  const surface = normalizeSurface(params);
  const patch = normalizePatch(params?.patch);

  if (!surface) {
    return {
      ok: false,
      error: "surfaceKind and surfaceKey must be non-empty strings.",
    };
  }

  if (isSlackSurface(surface)) {
    return {
      ok: false,
      error:
        "Raw Slack config patching is disabled for agents. Use get_slack_policy and preview_slack_policy_action instead.",
    };
  }

  if (!patch) {
    return {
      ok: false,
      error: "patch must be an object.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: `/api/internal/runtime/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/validate`,
    body: {
      patch,
    },
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    ...response.data,
  };
}

async function applyToolChange(api, params) {
  const surface = normalizeSurface(params);
  const patch = normalizePatch(params?.patch);
  const expectedEntryVersion =
    typeof params?.expectedEntryVersion === "number"
      ? params.expectedEntryVersion
      : null;
  const summary =
    typeof params?.summary === "string" ? params.summary : undefined;

  if (!surface) {
    return {
      ok: false,
      error: "surfaceKind and surfaceKey must be non-empty strings.",
    };
  }

  if (isSlackSurface(surface)) {
    return {
      ok: false,
      error:
        "Raw Slack config patching is disabled for agents. Use get_slack_policy and apply_slack_policy_action instead.",
    };
  }

  if (!expectedEntryVersion || !Number.isInteger(expectedEntryVersion)) {
    return {
      ok: false,
      error:
        "expectedEntryVersion is required and must come from a prior get_configurable_surface call.",
    };
  }

  if (!patch) {
    return {
      ok: false,
      error: "patch must be an object.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: `/api/internal/runtime/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/apply`,
    body: {
      expectedEntryVersion,
      patch,
      ...(summary ? { summary } : {}),
    },
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    ...response.data,
  };
}

async function previewSlackPolicyAction(api, params) {
  const action = normalizeSlackPolicyAction(params?.action);

  if (!action) {
    return {
      ok: false,
      error: "action must be a valid Slack policy action object.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: "/api/internal/runtime/slack/policy/validate",
    body: {
      action,
    },
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    ...response.data,
  };
}

async function applySlackPolicyAction(api, params) {
  const action = normalizeSlackPolicyAction(params?.action);
  const expectedEntryVersion =
    typeof params?.expectedEntryVersion === "number"
      ? params.expectedEntryVersion
      : null;
  const summary =
    typeof params?.summary === "string" ? params.summary : undefined;

  if (!action) {
    return {
      ok: false,
      error: "action must be a valid Slack policy action object.",
    };
  }

  if (!expectedEntryVersion || !Number.isInteger(expectedEntryVersion)) {
    return {
      ok: false,
      error:
        "expectedEntryVersion is required and must come from a prior get_slack_policy call.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: "/api/internal/runtime/slack/policy/apply",
    body: {
      action,
      expectedEntryVersion,
      ...(summary ? { summary } : {}),
    },
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    ...response.data,
  };
}

async function setToolInstallState(api, params) {
  const surface = normalizeSurface(params);
  const installState =
    params?.installState === "installed" || params?.installState === "uninstalled"
      ? params.installState
      : null;
  const enabled =
    typeof params?.enabled === "boolean" ? params.enabled : undefined;
  const expectedEntryVersion =
    typeof params?.expectedEntryVersion === "number"
      ? params.expectedEntryVersion
      : null;
  const summary =
    typeof params?.summary === "string" ? params.summary : undefined;

  if (!surface) {
    return {
      ok: false,
      error: "surfaceKind and surfaceKey must be non-empty strings.",
    };
  }

  if (!installState) {
    return {
      ok: false,
      error: "installState must be either installed or uninstalled.",
    };
  }

  if (!expectedEntryVersion || !Number.isInteger(expectedEntryVersion)) {
    return {
      ok: false,
      error:
        "expectedEntryVersion is required and must come from a prior get_configurable_surface call.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: `/api/internal/runtime/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/state`,
    body: {
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      expectedEntryVersion,
      installState,
      ...(summary ? { summary } : {}),
    },
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    ...response.data,
  };
}

async function reapplyTool(api, params) {
  const surface = normalizeSurface(params);
  const summary =
    typeof params?.summary === "string" ? params.summary : undefined;

  if (!surface) {
    return {
      ok: false,
      error: "surfaceKind and surfaceKey must be non-empty strings.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: `/api/internal/runtime/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/reapply`,
    body: summary ? { summary } : {},
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    ...response.data,
  };
}

function normalizeSurface(params) {
  const kind = typeof params?.surfaceKind === "string" ? params.surfaceKind : "";
  const key = typeof params?.surfaceKey === "string" ? params.surfaceKey : "";

  if (!kind.trim() || !key.trim()) {
    return null;
  }

  return {
    key,
    kind,
  };
}

function normalizePatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

function normalizeSlackPolicyAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

function isSlackSurface(surface) {
  return surface.kind === "channel" && surface.key === "slack";
}

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
      method: input.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(input.body ? { "Content-Type": "application/json" } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });

    const data = await parseJsonResponse(response);

    if (response.ok) {
      return {
        ok: true,
        data,
        status: response.status,
      };
    }

    const errorMessage = getControlPlaneErrorMessage({
      data,
      input,
      response,
      timeoutMs,
    });
    logPluginError("Control-plane request failed", {
      baseUrl,
      error: errorMessage,
      method: input.method,
      path: input.path,
      responseData: data,
      status: response.status,
      timeoutMs,
    });

    return {
      code: "control_plane_http_error",
      details:
        data && typeof data === "object" && !Array.isArray(data) ? data : undefined,
      error: errorMessage,
      method: input.method,
      ok: false,
      path: input.path,
      status: response.status,
    };
  } catch (error) {
    const errorMessage = getControlPlaneFetchErrorMessage({
      baseUrl,
      error,
      input,
      timeoutMs,
    });
    logPluginError("Control-plane request threw", {
      baseUrl,
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
            }
          : String(error),
      method: input.method,
      path: input.path,
      timeoutMs,
    });

    return {
      code:
        error instanceof Error && error.name === "AbortError"
          ? "control_plane_timeout"
          : "control_plane_request_failed",
      ok: false,
      error: errorMessage,
      method: input.method,
      path: input.path,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return text ? { error: text } : {};
  }

  return await response.json();
}

function getControlPlaneErrorMessage(input) {
  const upstreamMessage =
    input.data && typeof input.data === "object"
      ? typeof input.data.message === "string"
        ? input.data.message
        : typeof input.data.error === "string"
          ? input.data.error
          : null
      : null;

  return upstreamMessage
    ? `${input.input.method} ${input.input.path} failed with ${input.response.status}: ${upstreamMessage}`
    : `${input.input.method} ${input.input.path} failed with ${input.response.status}. Check workspace app logs for the corresponding request.`;
}

function getControlPlaneFetchErrorMessage(input) {
  if (input.error instanceof Error && input.error.name === "AbortError") {
    return `${input.input.method} ${input.input.path} timed out after ${input.timeoutMs}ms while calling the workspace app. Check runtime reachability to ${input.baseUrl}, inspect workspace app logs, or increase the plugin timeoutMs.`;
  }

  if (input.error instanceof Error) {
    return `${input.input.method} ${input.input.path} failed before a response was received: ${input.error.message}`;
  }

  return `${input.input.method} ${input.input.path} failed before a response was received.`;
}

function logPluginError(message, details) {
  try {
    console.error(`[otto-runtime-config] ${message}`, details);
  } catch {
    // Ignore logging failures inside the plugin runtime.
  }
}
