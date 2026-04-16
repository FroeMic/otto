import type { IntegrationExecutionContext } from "../../framework";

export type PostHogTarget = {
  environmentId?: string;
  key: string;
  label: string;
  organizationId?: string;
  projectId?: string;
};

export type PostHogIntegrationState = {
  defaultTargetKey?: string;
  host: string;
  targets: PostHogTarget[];
};

export type PostHogRequestInput = {
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
};

export class PostHogApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PostHogApiError";
    this.status = status;
  }
}

export function normalizePostHogHost(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("PostHog host is required.");
  }

  const url = new URL(trimmed);

  if (url.protocol !== "https:") {
    throw new Error("PostHog host must use https.");
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PostHog host must be an origin without a path.");
  }

  return url.origin;
}

export function buildPostHogOrganizationPath(
  organizationId: string,
  path: string,
) {
  return `/api/organizations/${encodeURIComponent(organizationId)}/${normalizePath(path)}`;
}

export function buildPostHogProjectPath(projectId: string, path: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/${normalizePath(path)}`;
}

export function buildPostHogEnvironmentPath(
  environmentId: string,
  path: string,
) {
  return `/api/environments/${encodeURIComponent(environmentId)}/${normalizePath(path)}`;
}

export function resolvePostHogTarget(input: {
  arguments: Record<string, unknown>;
  state: PostHogIntegrationState | Record<string, unknown>;
}) {
  const state = parsePostHogState(input.state);
  const explicitTarget = {
    environmentId: getString(input.arguments.environmentId),
    key: getString(input.arguments.targetKey) ?? "explicit",
    label: "Explicit target",
    organizationId: getString(input.arguments.organizationId),
    projectId: getString(input.arguments.projectId),
  } satisfies PostHogTarget;

  if (
    explicitTarget.environmentId ||
    explicitTarget.organizationId ||
    explicitTarget.projectId
  ) {
    return explicitTarget;
  }

  const targetKey = getString(input.arguments.targetKey);
  const resolved =
    state.targets.find((target) => target.key === targetKey) ??
    state.targets.find((target) => target.key === state.defaultTargetKey) ??
    state.targets[0];

  if (!resolved) {
    throw new Error("PostHog integration has no configured targets.");
  }

  return resolved;
}

export function prepareHogQlQuery(query: string, maxRows = 100) {
  const trimmed = query.trim();

  if (!trimmed) {
    throw new Error("HogQL query is required.");
  }

  if (maxRows < 1 || maxRows > 500) {
    throw new Error("HogQL maxRows must be no more than 500.");
  }

  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("HogQL execution is read-only.");
  }

  if (trimmed.replace(/;+\s*$/, "").includes(";")) {
    throw new Error("HogQL execution accepts a single statement.");
  }

  const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/, "");

  if (/\blimit\s+\d+\b/i.test(withoutTrailingSemicolon)) {
    return {
      maxRows,
      query: withoutTrailingSemicolon,
    };
  }

  return {
    maxRows,
    query: `${withoutTrailingSemicolon} limit ${maxRows}`,
  };
}

export function getPostHogAuth(context: IntegrationExecutionContext) {
  if (context.auth?.kind !== "api_key") {
    throw new Error("PostHog requires an API-key execution context.");
  }

  return {
    apiKey: context.auth.apiKey,
    declaredScopes: context.auth.declaredScopes,
    host: normalizePostHogHost(String(context.auth.state.host ?? "")),
    metadata: context.auth.metadata,
    state: parsePostHogState(context.auth.state),
  };
}

export async function requestPostHog(
  context: IntegrationExecutionContext,
  input: PostHogRequestInput,
) {
  const auth = getPostHogAuth(context);
  const url = new URL(input.path, auth.host);
  const response = await fetch(url, {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers: {
      Authorization: `Bearer ${auth.apiKey}`,
      "Content-Type": "application/json",
    },
    method: input.method ?? "GET",
  });

  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new PostHogApiError(getPostHogErrorMessage(payload), response.status);
  }

  return payload;
}

function parsePostHogState(
  state: PostHogIntegrationState | Record<string, unknown>,
): PostHogIntegrationState {
  const host = getString(state.host);
  const rawTargets = Array.isArray(state.targets) ? state.targets : [];
  const targets: PostHogTarget[] = [];

  for (const target of rawTargets) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      continue;
    }

    const key = getString(target.key);

    if (!key) {
      continue;
    }

    targets.push({
      environmentId: getString(target.environmentId),
      key,
      label: getString(target.label) ?? key,
      organizationId: getString(target.organizationId),
      projectId: getString(target.projectId),
    });
  }

  if (!host) {
    throw new Error("PostHog integration state is missing host.");
  }

  return {
    defaultTargetKey: getString(state.defaultTargetKey),
    host,
    targets,
  };
}

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      body: text,
    };
  }
}

function getPostHogErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const detail = "detail" in payload ? payload.detail : null;
    const error = "error" in payload ? payload.error : null;

    if (typeof detail === "string") {
      return detail;
    }

    if (typeof error === "string") {
      return error;
    }
  }

  return "PostHog API request failed.";
}
