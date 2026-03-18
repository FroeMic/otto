import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";

const MANAGED_FILE_PATHS = ["AGENTS.md", "IDENTITY.md", "TOOLS.md"];
const RUNTIME_CONFIG_SURFACES = [{ kind: "channel", key: "slack" }];
const DEFAULT_TIMEOUT_MS = 15_000;

const plugin = {
  id: "otto-managed-config",
  name: "Otto Control Plane",
  description:
    "Managed bootstrap and runtime config tools backed by the Otto control plane.",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerTool(
      {
        name: "list_managed_files",
        description:
          "List the managed bootstrap files Otto may inspect or update through the control plane.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
        async execute() {
          return buildToolResult(await listManagedFiles(api));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "read_managed_file",
        description:
          "Read the current control-plane-managed version of AGENTS.md, IDENTITY.md, or TOOLS.md.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            filePath: {
              type: "string",
              enum: MANAGED_FILE_PATHS,
            },
          },
          required: ["filePath"],
        },
        async execute(_id, params) {
          return buildToolResult(await readManagedFile(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "patch_managed_file",
        description:
          "Update the shared editable block of a managed bootstrap file through the Otto control plane.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            expectedVersion: {
              type: "integer",
              minimum: 1,
            },
            filePath: {
              type: "string",
              enum: MANAGED_FILE_PATHS,
            },
            sharedContent: {
              type: "string",
              minLength: 1,
            },
            summary: {
              type: "string",
              minLength: 1,
              maxLength: 500,
            },
          },
          required: ["expectedVersion", "filePath", "sharedContent"],
        },
        async execute(_id, params) {
          return buildToolResult(await patchManagedFile(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "list_runtime_config_surfaces",
        description:
          "List the runtime config surfaces Otto exposes through the control plane, including Slack policy config.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
        async execute() {
          return buildToolResult(await listRuntimeConfigSurfaces(api));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "read_runtime_config_surface",
        description:
          "Read the current runtime config, schema, and picker options for a control-plane-backed surface such as Slack.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            surfaceKey: {
              type: "string",
              enum: RUNTIME_CONFIG_SURFACES.map((surface) => surface.key),
            },
            surfaceKind: {
              type: "string",
              enum: RUNTIME_CONFIG_SURFACES.map((surface) => surface.kind),
            },
          },
          required: ["surfaceKind", "surfaceKey"],
        },
        async execute(_id, params) {
          return buildToolResult(await readRuntimeConfigSurface(api, params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "patch_runtime_config_surface",
        description:
          "Update a runtime config surface through the Otto control plane using optimistic concurrency and server-side validation.",
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
              additionalProperties: false,
              properties: {
                allowedChannelIds: {
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  type: "array",
                },
                allowedUserIds: {
                  items: {
                    type: "string",
                    minLength: 1,
                  },
                  type: "array",
                },
                answerInThreads: {
                  type: "boolean",
                },
                ackReactionEnabled: {
                  type: "boolean",
                },
                channelAccessMode: {
                  type: "string",
                  enum: ["manual_allowlist", "member_of_channels"],
                },
                requireMentionInChannels: {
                  type: "boolean",
                },
              },
            },
            summary: {
              type: "string",
              minLength: 1,
              maxLength: 500,
            },
            surfaceKey: {
              type: "string",
              enum: RUNTIME_CONFIG_SURFACES.map((surface) => surface.key),
            },
            surfaceKind: {
              type: "string",
              enum: RUNTIME_CONFIG_SURFACES.map((surface) => surface.kind),
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
          return buildToolResult(await patchRuntimeConfigSurface(api, params));
        },
      },
      { optional: true },
    );
  },
};

export default plugin;

async function listManagedFiles(api) {
  const response = await requestControlPlane(api, {
    method: "GET",
    path: "/api/internal/runtime/managed-config",
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    version: response.data.version,
    files: response.data.files.map((file) => ({
      description: file.description,
      label: file.label,
      path: file.path,
    })),
  };
}

async function readManagedFile(api, params) {
  const filePath = normalizeManagedFilePath(params?.filePath);

  if (!filePath) {
    return {
      ok: false,
      error: "filePath must be one of AGENTS.md, IDENTITY.md, or TOOLS.md.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "GET",
    path: `/api/internal/runtime/managed-config?filePath=${encodeURIComponent(filePath)}`,
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    file: response.data.file,
    version: response.data.version,
  };
}

async function patchManagedFile(api, params) {
  const filePath = normalizeManagedFilePath(params?.filePath);
  const sharedContent =
    typeof params?.sharedContent === "string" ? params.sharedContent : "";
  const expectedVersion =
    typeof params?.expectedVersion === "number" ? params.expectedVersion : null;
  const summary =
    typeof params?.summary === "string" ? params.summary : undefined;

  if (!filePath) {
    return {
      ok: false,
      error: "filePath must be one of AGENTS.md, IDENTITY.md, or TOOLS.md.",
    };
  }

  if (!sharedContent.trim()) {
    return {
      ok: false,
      error: "sharedContent must be a non-empty string.",
    };
  }

  if (
    !expectedVersion ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    return {
      ok: false,
      error:
        "expectedVersion is required and must come from a prior read_managed_file or list_managed_files call.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "PATCH",
    path: "/api/internal/runtime/managed-config",
    body: {
      expectedVersion,
      filePath,
      sharedContent,
      ...(summary ? { summary } : {}),
    },
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    applyQueued: response.data.applyQueued,
    changed: response.data.changed,
    currentVersion: response.data.currentVersion,
    desiredStateVersion: response.data.desiredStateVersion,
  };
}

async function listRuntimeConfigSurfaces(api) {
  const response = await requestControlPlane(api, {
    method: "GET",
    path: "/api/internal/runtime/config-surfaces",
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    surfaces: response.data.surfaces.map((surface) => ({
      description: surface.description,
      key: surface.key,
      kind: surface.kind,
      label: surface.label,
    })),
  };
}

async function readRuntimeConfigSurface(api, params) {
  const surface = normalizeRuntimeConfigSurface(params);

  if (!surface) {
    return {
      ok: false,
      error:
        "surfaceKind/surfaceKey must identify a supported Otto runtime config surface.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "GET",
    path: `/api/internal/runtime/config-surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}`,
  });

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    surface: response.data,
  };
}

async function patchRuntimeConfigSurface(api, params) {
  const surface = normalizeRuntimeConfigSurface(params);
  const expectedEntryVersion =
    typeof params?.expectedEntryVersion === "number"
      ? params.expectedEntryVersion
      : null;
  const patch =
    params?.patch &&
    typeof params.patch === "object" &&
    !Array.isArray(params.patch)
      ? params.patch
      : null;
  const summary =
    typeof params?.summary === "string" ? params.summary : undefined;

  if (!surface) {
    return {
      ok: false,
      error:
        "surfaceKind/surfaceKey must identify a supported Otto runtime config surface.",
    };
  }

  if (!expectedEntryVersion || !Number.isInteger(expectedEntryVersion)) {
    return {
      ok: false,
      error:
        "expectedEntryVersion is required and must come from a prior read_runtime_config_surface call.",
    };
  }

  if (!patch) {
    return {
      ok: false,
      error: "patch must be an object.",
    };
  }

  const response = await requestControlPlane(api, {
    method: "PATCH",
    path: `/api/internal/runtime/config-surfaces/${encodeURIComponent(surface.kind)}/${encodeURIComponent(surface.key)}`,
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
    applyQueued: response.data.applyQueued,
    changed: response.data.changed,
    currentEntryVersion: response.data.currentEntryVersion,
    desiredStateVersion: response.data.desiredStateVersion,
    surface: response.data.surface,
  };
}

function normalizeManagedFilePath(value) {
  return MANAGED_FILE_PATHS.includes(value) ? value : null;
}

function normalizeRuntimeConfigSurface(params) {
  const surfaceKind =
    typeof params?.surfaceKind === "string" ? params.surfaceKind : "";
  const surfaceKey =
    typeof params?.surfaceKey === "string" ? params.surfaceKey : "";

  return (
    RUNTIME_CONFIG_SURFACES.find(
      (surface) => surface.kind === surfaceKind && surface.key === surfaceKey,
    ) ?? null
  );
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
        : { error: "Managed config request failed." }),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Managed config request failed.",
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
