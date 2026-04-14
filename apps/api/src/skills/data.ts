import {
  type WorkspaceSkillDetailResponse,
  type WorkspaceSkillMutationResponse,
  type WorkspaceSkillsListResponse,
} from "@otto/feature-runtime-core"
import {
  buildManagedSkillMarkdown,
  MANAGED_SKILL_ENTRY_FILE_PATH,
  parseManagedSkillMarkdown,
} from "@otto/feature-runtime-core"
import { downloadRuntimePath } from "@otto/feature-runtime-core/runtime-files/download"
import { getRuntimeDirectorySnapshot } from "@otto/feature-runtime-core/runtime-files/snapshot"
import type {
  RuntimeDirectoryListingResponse,
  RuntimeDownloadKind,
  RuntimeDownloadResult,
} from "@otto/feature-runtime-core/runtime-files/types"
import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenants, tenantServers } from "@otto/feature-integrations-runtime/db/schema"
import { listIntegrationDefinitions } from "@otto/feature-integrations-runtime/integrations/framework"
import { desc, eq } from "drizzle-orm"

import { execTenantRuntimeCommand, getTenantRuntimeConnection } from "../tenant-runtime/ssh"
import {
  createTenantManagedSkillForTenant,
  getLatestTenantManagedSkillDetailForTenant,
  listTenantManagedSkillsForTenant,
  resetTenantManagedSkillPackageForTenant,
  updateTenantManagedSkillTextFileForTenant,
} from "../runtime/managed-skills-data"
import { getOrganizationWorkspaceBySlug } from "../workspace/data"

const AVAILABLE_SECTIONS = ["status", "files"] as const
const MANAGED_SKILLS_ROOT = "/opt/openclaw/home/workspace/skills"

type RuntimeWorkspaceRecord = {
  serverStatus: string | null
  tenantId: string
  tenantStatus: string
}

async function getLatestWorkspaceRuntime(input: {
  orgSlug: string
  userExternalId: string
}): Promise<RuntimeWorkspaceRecord | null> {
  const workspace = await getOrganizationWorkspaceBySlug(input)
  const db = getDb()
  const [tenant] = await db
    .select({
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenants.organizationId, workspace.id))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  return tenant ?? null
}

function listKnownManagedSkillDependencyIntegrationKeys() {
  return listIntegrationDefinitions()
    .map((definition) => definition.key)
    .sort((left, right) => left.localeCompare(right))
}

function mapManagedSkillDetail(detail: NonNullable<
  Awaited<ReturnType<typeof getLatestTenantManagedSkillDetailForTenant>>
>) {
  const skillEntryFile =
    detail.files.find((file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH) ?? null
  const parsedSkillDocument =
    skillEntryFile?.storageEncoding === "utf8_text" && skillEntryFile.contentText
      ? parseManagedSkillMarkdown(skillEntryFile.contentText)
      : null

  return {
    dependencies: {
      integrations: parsedSkillDocument?.integrationKeys ?? [],
      skills: parsedSkillDocument?.skillKeys ?? [],
    },
    description: detail.description,
    displayName: parsedSkillDocument?.name ?? detail.displayName,
    editable: detail.sourceType !== "system",
    files: detail.files.map((file) => ({
      contentSha256: file.contentSha256,
      contentText: file.contentText,
      contentType: file.contentType,
      editability: file.editability,
      fileClass: file.fileClass,
      path: file.path,
      resettable: file.resettable,
      storageEncoding: file.storageEncoding,
    })),
    skillKey: detail.skillKey,
    sourceType: normalizeSourceType(detail.sourceType),
    status: normalizeStatus(detail.status),
    summary: detail.summary,
    updatedAt: detail.updatedAt.toISOString(),
    version: detail.version,
  } as const
}

function normalizeSourceType(value: string) {
  if (
    value === "integration_contribution" ||
    value === "system" ||
    value === "user"
  ) {
    return value
  }

  throw new Error(`Unsupported managed skill source type: ${value}`)
}

function normalizeStatus(value: string) {
  if (
    value === "disabled" ||
    value === "invalid" ||
    value === "missing_prerequisite" ||
    value === "projection_failed" ||
    value === "ready"
  ) {
    return value
  }

  throw new Error(`Unsupported managed skill status: ${value}`)
}

export async function listWorkspaceSkills(input: {
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceSkillsListResponse> {
  const runtime = await getLatestWorkspaceRuntime(input)

  if (!runtime) {
    return {
      knownIntegrationKeys: listKnownManagedSkillDependencyIntegrationKeys(),
      skills: [],
      state: "pending_setup",
    }
  }

  const skills = await listTenantManagedSkillsForTenant({
    tenantId: runtime.tenantId,
  })

  return {
    knownIntegrationKeys: listKnownManagedSkillDependencyIntegrationKeys(),
    skills: skills.map((skill) => ({
      description: skill.description,
      displayName: skill.displayName,
      editable: skill.sourceType !== "system",
      enabled: skill.enabled,
      skillKey: skill.skillKey,
      sourceType: normalizeSourceType(skill.sourceType),
      status: normalizeStatus(skill.status),
      updatedAt: skill.updatedAt.toISOString(),
    })),
    state: "ready",
  }
}

export async function getWorkspaceSkillDetail(input: {
  orgSlug: string
  skillKey: string
  userExternalId: string
}): Promise<WorkspaceSkillDetailResponse | null> {
  const runtime = await getLatestWorkspaceRuntime({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (!runtime) {
    return {
      availableSections: [...AVAILABLE_SECTIONS],
      detail: null,
      knownIntegrationKeys: listKnownManagedSkillDependencyIntegrationKeys(),
      knownSkillKeys: [],
      state: "pending_setup",
    }
  }

  const [detail, skills] = await Promise.all([
    getLatestTenantManagedSkillDetailForTenant({
      skillKey: input.skillKey,
      tenantId: runtime.tenantId,
    }),
    listTenantManagedSkillsForTenant({
      tenantId: runtime.tenantId,
    }),
  ])

  if (!detail) {
    return null
  }

  return {
    availableSections: [...AVAILABLE_SECTIONS],
    detail: mapManagedSkillDetail(detail),
    knownIntegrationKeys: listKnownManagedSkillDependencyIntegrationKeys(),
    knownSkillKeys: skills
      .map((skill) => skill.skillKey)
      .filter((skillKey) => skillKey !== input.skillKey)
      .sort((left, right) => left.localeCompare(right)),
    state: "ready",
  }
}

export async function createWorkspaceSkill(input: {
  description: string
  integrationKeys: string[]
  name: string
  orgSlug: string
  skillBody: string
  skillKey: string
  skillKeys: string[]
  userExternalId: string
}): Promise<WorkspaceSkillMutationResponse> {
  const runtime = await getLatestWorkspaceRuntime({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (!runtime) {
    throw new Error("This workspace does not have a tenant runtime yet.")
  }

  const contentText = buildManagedSkillMarkdown({
    description: input.description,
    integrationKeys: input.integrationKeys,
    name: input.name,
    skillBody: input.skillBody,
    skillKeys: input.skillKeys,
  })
  const result = await createTenantManagedSkillForTenant({
    contentText,
    createdByExternalId: input.userExternalId,
    createdByType: "user",
    skillKey: input.skillKey,
    summary: `Created ${input.skillKey}`,
    tenantId: runtime.tenantId,
  })

  return {
    applyQueued: result.applyQueued,
    desiredStateVersion: result.desiredStateVersion,
    skillKey: result.skillKey,
    version: result.version,
  }
}

export async function updateWorkspaceSkill(input: {
  description: string
  expectedVersion?: number
  integrationKeys: string[]
  name: string
  orgSlug: string
  skillBody: string
  skillKey: string
  skillKeys: string[]
  userExternalId: string
}): Promise<WorkspaceSkillMutationResponse | null> {
  const runtime = await getLatestWorkspaceRuntime({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (!runtime) {
    return null
  }

  const detail = await getLatestTenantManagedSkillDetailForTenant({
    skillKey: input.skillKey,
    tenantId: runtime.tenantId,
  })

  if (!detail) {
    return null
  }

  const contentText = buildManagedSkillMarkdown({
    description: input.description,
    integrationKeys: input.integrationKeys,
    name: input.name,
    skillBody: input.skillBody,
    skillKeys: input.skillKeys,
  })
  const result = await updateTenantManagedSkillTextFileForTenant({
    contentText,
    createdByExternalId: input.userExternalId,
    createdByType: "user",
    expectedVersion: input.expectedVersion,
    relativePath: MANAGED_SKILL_ENTRY_FILE_PATH,
    skillKey: input.skillKey,
    summary: `Updated ${input.skillKey}`,
    tenantId: runtime.tenantId,
  })

  return {
    applyQueued: result.applyQueued ?? false,
    changed: result.changed,
    currentVersion: result.currentVersion,
    desiredStateVersion: result.desiredStateVersion ?? result.currentVersion,
    skillKey: result.skillKey,
  }
}

export async function resetWorkspaceSkillPackage(input: {
  expectedVersion?: number
  orgSlug: string
  scope: "companion_files"
  skillKey: string
  userExternalId: string
}) {
  const runtime = await getLatestWorkspaceRuntime({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (!runtime) {
    return null
  }

  const detail = await getLatestTenantManagedSkillDetailForTenant({
    skillKey: input.skillKey,
    tenantId: runtime.tenantId,
  })

  if (!detail) {
    return null
  }

  const result = await resetTenantManagedSkillPackageForTenant({
    createdByExternalId: input.userExternalId,
    createdByType: "user",
    expectedVersion: input.expectedVersion,
    scope: input.scope,
    skillKey: input.skillKey,
    summary: `Reset ${input.skillKey} package`,
    tenantId: runtime.tenantId,
  })

  return {
    applyQueued: result.applyQueued,
    desiredStateVersion: result.desiredStateVersion,
    resetScope: result.resetScope,
    skillKey: result.skillKey,
  }
}

export async function getWorkspaceSkillFilesDirectoryListing(input: {
  orgSlug: string
  skillKey: string
  userExternalId: string
}): Promise<RuntimeDirectoryListingResponse> {
  const runtime = await getLatestWorkspaceRuntime(input)

  if (
    !runtime ||
    runtime.tenantStatus !== "ready" ||
    runtime.serverStatus !== "ready"
  ) {
    return {
      snapshot: null,
      state: "pending_setup",
    }
  }

  const detail = await getLatestTenantManagedSkillDetailForTenant({
    skillKey: input.skillKey,
    tenantId: runtime.tenantId,
  })

  if (!detail) {
    throw new Error("Managed skill not found.")
  }

  const connection = await getTenantRuntimeConnection(
    runtime.tenantId,
    `GET /api/workspace/${input.orgSlug}/skills/${detail.skillKey}/files`,
  )
  const snapshot = await getRuntimeDirectorySnapshot({
    execute: (command) => execTenantRuntimeCommand(connection, command),
    failureMessage: `Failed to read skill directory for ${detail.skillKey}.`,
    rootPath: `${MANAGED_SKILLS_ROOT}/${detail.skillKey}`,
  })

  return {
    snapshot,
    state: "ready",
  }
}

export async function downloadWorkspaceSkillFile(input: {
  kind: RuntimeDownloadKind
  orgSlug: string
  relativePath: string
  skillKey: string
  userExternalId: string
}): Promise<RuntimeDownloadResult | null> {
  const runtime = await getLatestWorkspaceRuntime({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (
    !runtime ||
    runtime.tenantStatus !== "ready" ||
    runtime.serverStatus !== "ready"
  ) {
    return null
  }

  const detail = await getLatestTenantManagedSkillDetailForTenant({
    skillKey: input.skillKey,
    tenantId: runtime.tenantId,
  })

  if (!detail) {
    return null
  }

  const connection = await getTenantRuntimeConnection(
    runtime.tenantId,
    `GET /api/workspace/${input.orgSlug}/skills/${detail.skillKey}/files/download`,
  )

  return downloadRuntimePath({
    execute: (command) => execTenantRuntimeCommand(connection, command),
    kind: input.kind,
    relativePath: input.relativePath,
    rootPath: `${MANAGED_SKILLS_ROOT}/${detail.skillKey}`,
  })
}
