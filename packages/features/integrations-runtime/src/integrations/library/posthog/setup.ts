import { collectCommands } from "../../framework/search"
import {
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

type PostHogEnvironmentResource = IntegrationSetupResource & {
  metadata: {
    environmentId: string
    environmentLabel: string
    organizationId?: string
    organizationLabel?: string
    projectId: string
    projectLabel: string
  }
  parentKey: string
  type: "environment"
}

type PostHogSetupResource = PostHogProjectResource | PostHogEnvironmentResource

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
  const resources: PostHogSetupResource[] = []

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

  const detectedScopes = inferPostHogScopesFromDiscoveredResources(resources)
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
  resources: PostHogSetupResource[]
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
): PostHogSetupResource[] {
  const normalized: PostHogSetupResource[] = []

  for (const resource of resources) {
    if (resource.type !== "project" && resource.type !== "environment") {
      continue
    }

    const projectId =
      getMetadataString(resource.metadata, "projectId") ?? resource.id
    const environmentId = getMetadataString(resource.metadata, "environmentId")

    if (resource.type === "environment" && environmentId) {
      normalized.push({
        ...resource,
        metadata: {
          environmentId,
          environmentLabel:
            getMetadataString(resource.metadata, "environmentLabel") ??
            resource.label,
          organizationId: getMetadataString(
            resource.metadata,
            "organizationId",
          ),
          organizationLabel: getMetadataString(
            resource.metadata,
            "organizationLabel",
          ),
          projectId,
          projectLabel:
            getMetadataString(resource.metadata, "projectLabel") ??
            resource.label,
        },
        parentKey:
          resource.parentKey ??
          buildResourceKey(
            getMetadataString(resource.metadata, "projectLabel") ??
              resource.label,
            projectId,
          ),
        type: "environment" as const,
      })

      continue
    }

    normalized.push({
      ...resource,
      metadata: {
        environmentId,
        organizationId: getMetadataString(resource.metadata, "organizationId"),
        projectId,
      },
      type: "project" as const,
    })
  }

  return normalized
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
}): Promise<PostHogSetupResource[]> {
  const payload = await requestPostHogSetupApi({
    apiKey: input.apiKey,
    host: input.host,
    path: buildPostHogOrganizationPath(input.organization.id, "projects/"),
    tolerateForbidden: true,
  })
  const projects = normalizeListPayload(payload)

  const resources: PostHogSetupResource[] = []

  for (const [index, project] of projects.entries()) {
    const id = getString(project, "id") ?? getString(project, "uuid")

    if (!id) {
      continue
    }

    const label = getString(project, "name") ?? `Project ${id}`
    const environmentId =
      getString(project, "environment_id") ??
      getString(project, "environmentId") ??
      getFirstNestedId(project, "environments")
    const projectResource = {
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
    } satisfies PostHogProjectResource
    const environments = await discoverProjectEnvironments({
      apiKey: input.apiKey,
      host: input.host,
      organization: input.organization,
      project: {
        id,
        key: projectResource.key,
        label,
      },
      warnings: input.warnings,
    })

    if (environments.length > 0) {
      resources.push(
        ...environments.map((environment, environmentIndex) => ({
          ...environment,
          selectedByDefault: index === 0 && environmentIndex === 0,
        })),
      )
    } else {
      resources.push(projectResource)
      input.warnings.push(
        `Otto could not discover PostHog environments for ${label}. Query, insight, and dashboard commands will need an explicit environmentId until PostHog discovery is rerun with environment access.`,
      )
    }
  }

  return resources
}

async function discoverProjectEnvironments(input: {
  apiKey: string
  host: string
  organization: { id: string; label: string }
  project: { id: string; key: string; label: string }
  warnings: string[]
}): Promise<PostHogEnvironmentResource[]> {
  const payload = await requestPostHogSetupApi({
    apiKey: input.apiKey,
    host: input.host,
    path: buildPostHogProjectPath(input.project.id, "environments/"),
    tolerateForbidden: true,
  })
  const environments = normalizeListPayload(payload)

  return environments.flatMap((environment) => {
    const id = getString(environment, "id") ?? getString(environment, "uuid")

    if (!id) {
      return []
    }

    const label =
      getString(environment, "name") ??
      getString(environment, "label") ??
      `Environment ${id}`
    const fullLabel = `${input.project.label} / ${label}`

    return [
      {
        id,
        key: buildResourceKey(fullLabel, id),
        label: fullLabel,
        metadata: {
          environmentId: id,
          environmentLabel: label,
          organizationId: input.organization.id,
          organizationLabel: input.organization.label,
          projectId: input.project.id,
          projectLabel: input.project.label,
        },
        parentKey: input.project.key,
        type: "environment" as const,
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

function inferPostHogScopesFromDiscoveredResources(
  resources: PostHogSetupResource[],
) {
  if (resources.length === 0) {
    return []
  }

  const runtimeSurface = posthogIntegrationDefinition.runtimeSurface

  if (!runtimeSurface) {
    return ["project:read"]
  }

  const scopes = new Set<string>(["project:read"])

  for (const command of collectCommands(runtimeSurface)) {
    for (const scope of command.requiredProviderScopes ?? []) {
      scopes.add(scope)
    }
  }

  return [...scopes].sort((left, right) => left.localeCompare(right))
}

function buildResourceKey(label: string, id: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const normalizedId = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return slug ? `${slug}_${normalizedId || id}` : normalizedId || id
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
