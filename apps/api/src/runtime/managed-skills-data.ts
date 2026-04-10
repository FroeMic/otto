import { createHash } from "node:crypto"

import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  tenantDesiredStates,
  tenantServers,
  tenantSkillFiles,
  tenantSkillFileVersions,
  tenantSkills,
  tenantSkillVersions,
  tenants,
} from "@otto/feature-integrations-runtime/db/schema"
import { and, desc, eq } from "drizzle-orm"

export const MANAGED_SKILL_ENTRY_FILE_PATH = "SKILL.md"

export class ManagedSkillVersionConflictError extends Error {
  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `Managed skill version mismatch: expected ${expectedVersion}, current ${currentVersion}`,
    )
  }
}

type ManagedSkillDetail = {
  files: Array<{
    contentSha256: string | null
    contentText: string | null
    contentType: string | null
    editability: "download_only" | "editable"
    path: string
    storageEncoding: "binary" | "utf8_text"
  }>
  skillId: string
  skillKey: string
  sourceType: string
  version: number
}

type ManagedSkillsDesiredState = {
  managedSkills?: {
    versions?: Record<string, number>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createTextChecksum(contentText: string) {
  return createHash("sha256").update(contentText).digest("hex")
}

function parseManagedSkillsDesiredState(
  value: unknown,
): ManagedSkillsDesiredState {
  if (!isRecord(value)) {
    return {}
  }

  const managedSkills = value.managedSkills
  if (!isRecord(managedSkills)) {
    return {}
  }

  const versionsValue = managedSkills.versions
  const versions: Record<string, number> = {}

  if (isRecord(versionsValue)) {
    for (const [key, entry] of Object.entries(versionsValue)) {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        versions[key] = entry
      }
    }
  }

  return {
    managedSkills: {
      versions,
    },
  }
}

async function getLatestDesiredState(tenantId: string) {
  const db = getDb()
  const [state] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1)

  return state ?? null
}

async function getTenantRuntimeState(tenantId: string) {
  const db = getDb()
  const [tenantRow] = await db
    .select({
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenantRow) {
    throw new Error(`Tenant ${tenantId} not found`)
  }

  return {
    isRuntimeReady:
      tenantRow.tenantStatus === "ready" && tenantRow.serverStatus === "ready",
  }
}

async function createNextDesiredStateVersionForManagedSkills(input: {
  skillKey: string
  tenantId: string
  version: number
}) {
  const db = getDb()
  const latestDesiredState = await getLatestDesiredState(input.tenantId)
  const nextVersion = (latestDesiredState?.version ?? 0) + 1
  const currentConfig = isRecord(latestDesiredState?.configJson)
    ? { ...latestDesiredState.configJson }
    : {}
  const currentState = parseManagedSkillsDesiredState(currentConfig)
  const currentManagedSkills = currentState.managedSkills ?? {}
  const currentVersions = currentManagedSkills.versions ?? {}

  const configJson = {
    ...currentConfig,
    managedSkills: {
      ...currentManagedSkills,
      versions: {
        ...currentVersions,
        [input.skillKey]: input.version,
      },
    },
  }

  const [createdDesiredState] = await db
    .insert(tenantDesiredStates)
    .values({
      configJson,
      tenantId: input.tenantId,
      version: nextVersion,
    })
    .returning({
      version: tenantDesiredStates.version,
    })

  return createdDesiredState
}

export async function listTenantManagedSkillsForTenant(input: {
  tenantId: string
}) {
  const db = getDb()

  return db
    .select({
      description: tenantSkills.description,
      displayName: tenantSkills.displayName,
      enabled: tenantSkills.enabled,
      skillId: tenantSkills.id,
      skillKey: tenantSkills.skillKey,
      sourceType: tenantSkills.sourceType,
      status: tenantSkills.status,
      updatedAt: tenantSkills.updatedAt,
    })
    .from(tenantSkills)
    .where(eq(tenantSkills.tenantId, input.tenantId))
    .orderBy(desc(tenantSkills.updatedAt), tenantSkills.skillKey)
}

export async function getLatestTenantManagedSkillDetailForTenant(input: {
  skillKey: string
  tenantId: string
}): Promise<ManagedSkillDetail | null> {
  const db = getDb()
  const [skill] = await db
    .select({
      skillId: tenantSkills.id,
      skillKey: tenantSkills.skillKey,
      sourceType: tenantSkills.sourceType,
    })
    .from(tenantSkills)
    .where(
      and(
        eq(tenantSkills.tenantId, input.tenantId),
        eq(tenantSkills.skillKey, input.skillKey),
      ),
    )
    .limit(1)

  if (!skill) {
    return null
  }

  const [latestVersion] = await db
    .select({
      id: tenantSkillVersions.id,
      version: tenantSkillVersions.version,
    })
    .from(tenantSkillVersions)
    .where(eq(tenantSkillVersions.tenantSkillId, skill.skillId))
    .orderBy(desc(tenantSkillVersions.version))
    .limit(1)

  if (!latestVersion) {
    throw new Error(
      `Managed skill ${input.skillKey} has no stored versions for tenant ${input.tenantId}.`,
    )
  }

  const fileRows = await db
    .select({
      contentEncoding: tenantSkillFiles.contentEncoding,
      contentSha256: tenantSkillFiles.contentSha256,
      contentText: tenantSkillFileVersions.contentText,
      contentType: tenantSkillFiles.contentType,
      relativePath: tenantSkillFiles.relativePath,
    })
    .from(tenantSkillFileVersions)
    .innerJoin(
      tenantSkillFiles,
      eq(tenantSkillFiles.id, tenantSkillFileVersions.tenantSkillFileId),
    )
    .where(eq(tenantSkillFileVersions.tenantSkillVersionId, latestVersion.id))
    .orderBy(tenantSkillFiles.relativePath)

  return {
    files: fileRows.map((file) => ({
      contentSha256: file.contentSha256,
      contentText: file.contentText,
      contentType: file.contentType,
      editability:
        file.contentEncoding === "utf8_text" &&
        file.relativePath === MANAGED_SKILL_ENTRY_FILE_PATH &&
        skill.sourceType !== "system"
          ? "editable"
          : "download_only",
      path: file.relativePath,
      storageEncoding:
        file.contentEncoding === "utf8_text" ? "utf8_text" : "binary",
    })),
    skillId: skill.skillId,
    skillKey: skill.skillKey,
    sourceType: skill.sourceType,
    version: latestVersion.version,
  }
}

export async function updateTenantManagedSkillTextFileForTenant(input: {
  contentText: string
  createdByExternalId?: string | null
  createdByType: "runtime" | "system" | "user"
  expectedVersion?: number
  relativePath: string
  skillKey: string
  summary?: string
  tenantId: string
}) {
  const db = getDb()
  const detail = await getLatestTenantManagedSkillDetailForTenant({
    skillKey: input.skillKey,
    tenantId: input.tenantId,
  })

  if (!detail) {
    throw new Error(
      `Managed skill ${input.skillKey} does not exist for this workspace.`,
    )
  }

  if (
    input.expectedVersion !== undefined &&
    detail.version !== input.expectedVersion
  ) {
    throw new ManagedSkillVersionConflictError(
      input.expectedVersion,
      detail.version,
    )
  }

  const normalizedPath = input.relativePath.trim().replaceAll("\\", "/")

  if (detail.sourceType === "system" && input.createdByType !== "system") {
    throw new Error(
      "System-managed skills cannot be edited through the managed-skills surface.",
    )
  }

  if (normalizedPath !== MANAGED_SKILL_ENTRY_FILE_PATH) {
    throw new Error(
      "Only SKILL.md can be edited through the managed-skills surface.",
    )
  }

  const targetFile = detail.files.find((file) => file.path === normalizedPath)

  if (!targetFile) {
    throw new Error(
      `Managed skill file ${normalizedPath} does not exist in ${detail.skillKey}.`,
    )
  }

  if (targetFile.storageEncoding !== "utf8_text") {
    throw new Error(`Managed skill file ${normalizedPath} is not editable.`)
  }

  if (targetFile.contentText === input.contentText) {
    return {
      changed: false,
      currentVersion: detail.version,
      skillKey: detail.skillKey,
    }
  }

  const managedFileRows = await db
    .select({
      fileId: tenantSkillFiles.id,
      relativePath: tenantSkillFiles.relativePath,
    })
    .from(tenantSkillFiles)
    .where(eq(tenantSkillFiles.tenantSkillId, detail.skillId))
    .orderBy(tenantSkillFiles.relativePath)

  const fileIdByPath = new Map(
    managedFileRows.map((file) => [file.relativePath, file.fileId]),
  )

  const [createdVersion] = await db
    .insert(tenantSkillVersions)
    .values({
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      summary: input.summary ?? `Updated ${detail.skillKey}/${normalizedPath}`,
      tenantSkillId: detail.skillId,
      version: detail.version + 1,
    })
    .returning({
      id: tenantSkillVersions.id,
      version: tenantSkillVersions.version,
    })

  for (const file of detail.files) {
    const fileId = fileIdByPath.get(file.path)

    if (!fileId) {
      throw new Error(
        `Managed skill file metadata is missing for ${detail.skillKey}/${file.path}.`,
      )
    }

    const contentText =
      file.path === normalizedPath ? input.contentText : file.contentText

    await db.insert(tenantSkillFileVersions).values({
      contentSha256:
        file.path === normalizedPath
          ? createTextChecksum(input.contentText)
          : (file.contentSha256 ?? createTextChecksum(file.contentText ?? "")),
      contentText: contentText ?? "",
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      tenantSkillFileId: fileId,
      tenantSkillVersionId: createdVersion.id,
      version: createdVersion.version,
    })
  }

  const desiredStateVersion =
    await createNextDesiredStateVersionForManagedSkills({
      skillKey: detail.skillKey,
      tenantId: input.tenantId,
      version: createdVersion.version,
    })
  const tenantRuntime = await getTenantRuntimeState(input.tenantId)

  return {
    applyQueued: tenantRuntime.isRuntimeReady,
    changed: true,
    currentVersion: createdVersion.version,
    desiredStateVersion: desiredStateVersion.version,
    skillKey: detail.skillKey,
  }
}
