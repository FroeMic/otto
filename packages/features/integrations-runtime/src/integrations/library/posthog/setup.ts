import { collectCommands } from "../../framework/search"
import {
  buildPostHogEnvironmentPath,
  buildPostHogOrganizationPath,
  buildPostHogProjectPath,
  normalizePostHogHost,
} from "./client"
import { posthogIntegrationDefinition } from "./definition"

export type IntegrationSetupCapabilityRecommendation = {
  capabilityKey: string
  defaultEnabled: boolean
  label: string
  reason: string | null
  requiredScopes: string[]
  status: "available" | "recommended" | "sensitive" | "unavailable"
}

export type IntegrationSetupResource = {
  id: string
  key: string
  label: string
  metadata?: Record<string, unknown>
  parentKey?: string
  selectedByDefault?: boolean
  type: string
}

export type IntegrationSetupDiscoveryResult = {
  account: {
    externalId: string | null
    label: string | null
  } | null
  capabilityRecommendations: IntegrationSetupCapabilityRecommendation[]
  credential: {
    detectedScopes: string[]
    warnings: string[]
  }
  ok: boolean
  resources: IntegrationSetupResource[]
  statePreview: Record<string, unknown>
  warnings: string[]
}

type PostHogDiscoveryInput = {
  apiKey: string
  host: string
}

type PostHogProjectResource = IntegrationSetupResource & {
  metadata: {
    environmentId?: string
    organizationId?: string
    projectId: string
  }
  type: "project"
}

const SENSITIVE_CAPABILITIES = new Set([
  "person.list",
  "query.hogql",
  "session_recording.list",
])

export async function discoverPostHogIntegrationSetup(
  input: PostHogDiscoveryInput,
): Promise<IntegrationSetupDiscoveryResult> {
  const host = normalizePostHogHost(input.host)
  const warnings: string[] = []
  const user = await requestPostHogSetupApi({
    apiKey: input.apiKey,
    host,
    path: "/api/users/@me/",
  })
  const organizations = await discoverOrganizations({
    apiKey: input.apiKey,
    host,
    warnings,
  })
  const resources: PostHogProjectResource[] = []

  for (const organization of organizations) {
    const projects = await discoverOrganizationProjects({
      apiKey: input.apiKey,
      host,
      organization,
      warnings,
    })
    resources.push(...projects)
  }

  if (organizations.length === 0) {
    warnings.push(
      "Otto could authenticate with PostHog but could not list organizations. Enter a key with organization/project read access or reconnect after granting access.",
    )
  }

  if (resources.length === 0) {
    warnings.push(
      "Otto could not discover PostHog projects for this key. Project selection will be unavailable until project read access is granted.",
    )
  }

  const detectedScopes = await detectPostHogScopes({
    apiKey: input.apiKey,
    host,
    resources,
  })
  const capabilityRecommendations =
    buildPostHogCapabilityRecommendations(detectedScopes)
  const selectedResources = resources.filter(
    (resource) => resource.selectedByDefault,
  )

  return {
    account: {
      externalId: getString(user, "uuid") ?? getString(user, "id") ?? null,
      label:
        getString(user, "email") ??
        getString(user, "distinct_id") ??
        getString(user, "first_name") ??
        null,
    },
    capabilityRecommendations,
    credential: {
      detectedScopes,
      warnings: [],
    },
    ok: true,
    resources,
    statePreview: buildPostHogSetupState({
      host,
      resources: selectedResources,
      selectedResourceKeys: selectedResources.map((resource) => resource.key),
    }),
    warnings,
  }
}

export function buildPostHogSetupState(input: {
  defaultResourceKey?: string
  host: string
  resources: PostHogProjectResource[]
  selectedResourceKeys: string[]
}) {
  const selected = input.resources.filter((resource) =>
    input.selectedResourceKeys.includes(resource.key),
  )
  const defaultTargetKey =
    input.defaultResourceKey &&
    selected.some((resource) => resource.key === input.defaultResourceKey)
      ? input.defaultResourceKey
      : selected[0]?.key

  return {
    defaultTargetKey,
    host: input.host,
    setup: {
      defaultResourceKey: defaultTargetKey,
      discoveredAt: new Date().toISOString(),
      resources: input.resources,
      selectedResourceKeys: selected.map((resource) => resource.key),
      schemaVersion: 1,
    },
    targets: selected.map((resource) => ({
      environmentId: resource.metadata.environmentId,
      key: resource.key,
      label: resource.label,
      organizationId: resource.metadata.organizationId,
      projectId: resource.metadata.projectId,
    })),
  }
}

export function buildPostHogCapabilityRecommendations(
  detectedScopes: string[],
) {
  const runtimeSurface = posthogIntegrationDefinition.runtimeSurface

  if (!runtimeSurface) {
    return []
  }

  const scopeSet = new Set(detectedScopes)

  return collectCommands(runtimeSurface).map((command) => {
    const requiredScopes = command.requiredProviderScopes ?? []
    const missingScopes = requiredScopes.filter((scope) => !scopeSet.has(scope))
    const sensitive = SENSITIVE_CAPABILITIES.has(command.commandKey)
    const write = command.effect === "write"

    if (missingScopes.length > 0) {
      return {
        capabilityKey: command.commandKey,
        defaultEnabled: false,
        label: command.label,
        reason: `Missing ${missingScopes.join(", ")}.`,
        requiredScopes,
        status: "unavailable" as const,
      }
    }

    if (sensitive) {
      return {
        capabilityKey: command.commandKey,
        defaultEnabled: false,
        label: command.label,
        reason: "Sensitive data access is off by default.",
        requiredScopes,
        status: "sensitive" as const,
      }
    }

    return {
      capabilityKey: command.commandKey,
      defaultEnabled: !write,
      label: command.label,
      reason: write ? "Write access is available but off by default." : null,
      requiredScopes,
      status: write ? ("available" as const) : ("recommended" as const),
    }
  })
}

export function normalizePostHogSetupResources(
  resources: IntegrationSetupResource[],
): PostHogProjectResource[] {
  return resources.flatMap((resource) => {
    if (resource.type !== "project") {
      return []
    }

    const projectId =
      getMetadataString(resource.metadata, "projectId") ?? resource.id

    return [
      {
        ...resource,
        metadata: {
          environmentId: getMetadataString(resource.metadata, "environmentId"),
          organizationId: getMetadataString(
            resource.metadata,
            "organizationId",
          ),
          projectId,
        },
        type: "project" as const,
      },
    ]
  })
}

async function discoverOrganizations(input: {
  apiKey: string
  host: string
  warnings: string[]
}) {
  const payload = await requestPostHogSetupApi({
    apiKey: input.apiKey,
    host: input.host,
    path: "/api/organizations/",
    tolerateForbidden: true,
  })
  const organizations = normalizeListPayload(payload)

  return organizations.flatMap((organization) => {
    const id = getString(organization, "id") ?? getString(organization, "uuid")

    if (!id) {
      return []
    }

    return [
      {
        id,
        label: getString(organization, "name") ?? id,
      },
    ]
  })
}

async function discoverOrganizationProjects(input: {
  apiKey: string
  host: string
  organization: { id: string; label: string }
  warnings: string[]
}): Promise<PostHogProjectResource[]> {
  const payload = await requestPostHogSetupApi({
    apiKey: input.apiKey,
    host: input.host,
    path: buildPostHogOrganizationPath(input.organization.id, "projects/"),
    tolerateForbidden: true,
  })
  const projects = normalizeListPayload(payload)

  return projects.flatMap((project, index) => {
    const id = getString(project, "id") ?? getString(project, "uuid")

    if (!id) {
      return []
    }

    const label = getString(project, "name") ?? `Project ${id}`
    const environmentId =
      getString(project, "environment_id") ??
      getString(project, "environmentId") ??
      getFirstNestedId(project, "environments")

    return [
      {
        id,
        key: buildResourceKey(label, id),
        label,
        metadata: {
          environmentId,
          organizationId: input.organization.id,
          organizationLabel: input.organization.label,
          projectId: id,
        },
        selectedByDefault: index === 0,
        type: "project" as const,
      },
    ]
  })
}

async function requestPostHogSetupApi(input: {
  apiKey: string
  body?: unknown
  host: string
  method?: "GET" | "POST"
  path: string
  tolerateForbidden?: boolean
}) {
  const response = await fetch(new URL(input.path, input.host), {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    method: input.method ?? "GET",
  })
  const payload = await readJsonResponse(response)

  if (response.ok) {
    return payload
  }

  if (
    input.tolerateForbidden &&
    (response.status === 403 || response.status === 404)
  ) {
    return []
  }

  throw new Error(getPostHogSetupErrorMessage(payload, response.status))
}

function normalizeListPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord)
  }

  if (isRecord(payload) && Array.isArray(payload.results)) {
    return payload.results.filter(isRecord)
  }

  return []
}

async function readJsonResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return {
      body: text,
    }
  }
}

function getPostHogSetupErrorMessage(payload: unknown, status: number) {
  if (isRecord(payload)) {
    const detail = getString(payload, "detail") ?? getString(payload, "message")

    if (detail) {
      return detail
    }
  }

  if (status === 401) {
    return "PostHog rejected this Personal API key for the selected host."
  }

  return `PostHog setup discovery failed with status ${status}.`
}

async function detectPostHogScopes(input: {
  apiKey: string
  host: string
  resources: PostHogProjectResource[]
}) {
  const target = input.resources[0]

  if (!target) {
    return []
  }

  const detected = new Set<string>(["project:read"])
  const projectId = target.metadata.projectId
  const environmentId = target.metadata.environmentId
  const probes: Array<{
    body?: unknown
    method?: "GET" | "POST"
    path: string | null
    scope: string
  }> = [
    {
      path: buildPostHogProjectPath(projectId, "actions/"),
      scope: "action:read",
    },
    {
      path: buildPostHogProjectPath(projectId, "annotations/"),
      scope: "annotation:read",
    },
    {
      path: buildPostHogProjectPath(projectId, "event_definitions/"),
      scope: "event_definition:read",
    },
    {
      path: buildPostHogProjectPath(projectId, "experiments/"),
      scope: "experiment:read",
    },
    {
      path: buildPostHogProjectPath(projectId, "feature_flags/"),
      scope: "feature_flag:read",
    },
    {
      path: buildPostHogProjectPath(projectId, "persons/"),
      scope: "person:read",
    },
    {
      path: buildPostHogProjectPath(projectId, "property_definitions/"),
      scope: "property_definition:read",
    },
    {
      path: buildPostHogProjectPath(projectId, "session_recordings/"),
      scope: "session_recording:read",
    },
    {
      path: environmentId
        ? buildPostHogEnvironmentPath(environmentId, "dashboards/")
        : null,
      scope: "dashboard:read",
    },
    {
      path: environmentId
        ? buildPostHogEnvironmentPath(environmentId, "insights/")
        : null,
      scope: "insight:read",
    },
    {
      body: {
        query: {
          kind: "HogQLQuery",
          query: "select 1 limit 1",
        },
      },
      method: "POST",
      path: environmentId
        ? buildPostHogEnvironmentPath(environmentId, "query/")
        : null,
      scope: "query:read",
    },
  ]

  for (const probe of probes) {
    if (!probe.path) {
      continue
    }

    try {
      await requestPostHogSetupApi({
        apiKey: input.apiKey,
        body: probe.body,
        host: input.host,
        method: probe.method,
        path: probe.path,
      })
      detected.add(probe.scope)
    } catch {
      // A failed probe means the capability remains unavailable. The setup UI
      // shows the missing scope on the corresponding capability.
    }
  }

  return [...detected].sort((left, right) => left.localeCompare(right))
}

function buildResourceKey(label: string, id: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return slug ? `${slug}_${id}` : id
}

function getFirstNestedId(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (!Array.isArray(value)) {
    return undefined
  }

  const first = value.find(isRecord)

  return first
    ? (getString(first, "id") ?? getString(first, "uuid"))
    : undefined
}

function getString(record: unknown, key: string) {
  if (!isRecord(record)) {
    return undefined
  }

  const value = record[key]

  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key]

  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
