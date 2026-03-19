import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";

const DEFAULT_TIMEOUT_MS = 15_000;

const plugin = {
  id: "otto-tool-config",
  name: "Otto Tool Config",
  description:
    "Tool configuration and lifecycle tools backed by the Otto control plane.",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerTool(
      {
        name: "list_configurable_tools",
        description:
          "List the tool surfaces Otto exposes through the control plane, including current lifecycle state and allowed actions.",
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
        name: "get_configurable_tool",
        description:
          "Read one configurable tool surface, including its current config, field meanings, options, and allowed actions.",
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
        name: "validate_tool_change",
        description:
          "Dry-run validation for a tool config patch without persisting it.",
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
        name: "apply_tool_change",
        description:
          "Apply a validated config patch to a tool surface through the Otto control plane.",
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
        name: "set_tool_install_state",
        description:
          "Install, uninstall, enable, or disable a configurable tool surface. To enable or disable, pass the current installState plus the desired enabled value.",
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
        name: "reapply_tool",
        description:
          "Re-run desired-state compilation and queue a tenant apply for a tool surface without changing its saved config.",
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
};

export default plugin;

async function listConfigurableTools(api) {
  const response = await requestControlPlane(api, {
    method: "GET",
    path: "/api/internal/runtime/tool-config/surfaces",
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
    path: `/api/internal/runtime/tool-config/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}`,
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    surface: response.data,
  };
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

  if (!patch) {
    return {
      ok: false,
      error: "patch must be an object.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: `/api/internal/runtime/tool-config/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/validate`,
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

  if (!expectedEntryVersion || !Number.isInteger(expectedEntryVersion)) {
    return {
      ok: false,
      error:
        "expectedEntryVersion is required and must come from a prior get_configurable_tool call.",
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
    path: `/api/internal/runtime/tool-config/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/apply`,
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
        "expectedEntryVersion is required and must come from a prior get_configurable_tool call.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "POST",
    path: `/api/internal/runtime/tool-config/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/state`,
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
    path: `/api/internal/runtime/tool-config/surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}/reapply`,
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

function resolveGatewayToken() {
  const raw = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
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
  const token = resolveGatewayToken();

  if (!baseUrl) {
    return {
      ok: false,
      error:
        "OTTO_CONTROL_PLANE_BASE_URL is not set in the runtime environment.",
    };
  }

  if (!token) {
    return {
      ok: false,
      error: "OPENCLAW_GATEWAY_TOKEN is not set in the runtime environment.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveTimeoutMs(api));

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

    return {
      ok: false,
      status: response.status,
      ...(data && typeof data === "object"
        ? data
        : { error: "Tool config request failed." }),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Tool config request failed.",
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
