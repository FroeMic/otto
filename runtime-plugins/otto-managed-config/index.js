import { definePluginEntry } from "openclaw/plugin-sdk/core";

const MANAGED_FILE_PATHS = ["AGENTS.md", "IDENTITY.md", "TOOLS.md"];
const DEFAULT_TIMEOUT_MS = 15_000;

export default definePluginEntry({
  id: "otto-managed-config",
  name: "Otto Managed Config",
  description: "Managed bootstrap file tools backed by the Otto control plane.",
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
  },
});

async function listManagedFiles(api) {
  const response = await requestManagedConfig(api, {
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

  const response = await requestManagedConfig(api, {
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
  const summary = typeof params?.summary === "string" ? params.summary : undefined;

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

  if (!expectedVersion || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      ok: false,
      error:
        "expectedVersion is required and must come from a prior read_managed_file or list_managed_files call.",
    };
  }

  const response = await requestManagedConfig(api, {
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

async function requestManagedConfig(api, input) {
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
