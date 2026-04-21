import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const MANAGED_FILE_PATHS = [
  "AGENTS.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "MEMORY.md",
  "SOUL.md",
  "USER.md",
  "TOOLS.md",
];
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
  id: "otto-managed-config",
  name: "Otto Managed Config",
  description:
    "Managed instruction file tools backed by the workspace app.",
  configSchema: PLUGIN_CONFIG_SCHEMA,
  register(api) {
    api.registerTool(
      {
        name: "list_managed_files",
        description:
          "List managed personalization files backed by the workspace app. These files are the canonical source for Agent > Personalization.",
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
          'Read "filename" from the workspace-app-managed personalization files. Use this before updating AGENTS.md, HEARTBEAT.md, IDENTITY.md, MEMORY.md, SOUL.md, USER.md, or TOOLS.md.',
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
          'Update "Filename" in the workspace-app-managed personalization files. Use this for user-visible personalization changes; do not edit root copies of these files directly.',
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
  },
});

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
      error:
        "filePath must be one of AGENTS.md, HEARTBEAT.md, IDENTITY.md, MEMORY.md, SOUL.md, USER.md, or TOOLS.md.",
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
      error:
        "filePath must be one of AGENTS.md, HEARTBEAT.md, IDENTITY.md, MEMORY.md, SOUL.md, USER.md, or TOOLS.md.",
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

function normalizeManagedFilePath(value) {
  return MANAGED_FILE_PATHS.includes(value) ? value : null;
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
      error: errorMessage,
      method: input.method,
      ok: false,
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
    console.error(`[otto-managed-config] ${message}`, details);
  } catch {
    // Ignore logging failures inside the plugin runtime.
  }
}
