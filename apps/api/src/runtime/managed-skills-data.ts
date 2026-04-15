import { createHash } from "node:crypto"

import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { SYSTEM_MANAGED_SKILL_DEFINITIONS } from "@otto/feature-runtime-core"
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

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"

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
  description: string
  displayName: string
  enabled: boolean
  files: Array<{
    contentSha256: string | null
    contentText: string | null
    contentType: string | null
    editability: "download_only" | "editable"
    fileClass: "managed_entry" | "managed_seeded"
    path: string
    resettable: boolean
    storageEncoding: "binary" | "utf8_text"
  }>
  skillId: string
  skillKey: string
  sourceType: string
  status: string
  summary: string | null
  updatedAt: Date
  version: number
}

type ManagedSkillPatch = {
  contentText?: string
  description?: string
  enabled?: boolean
  integrationKeys?: string[]
  skillBody?: string
  skillKeys?: string[]
}

type ParsedManagedSkillDocument = {
  description: string
  integrationKeys: string[]
  name: string
  skillBody: string
  skillKeys: string[]
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
  remove?: boolean
  skillKey: string
  tenantId: string
  version?: number
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
        ...(input.remove
          ? Object.fromEntries(
              Object.entries(currentVersions).filter(
                ([key]) => key !== input.skillKey,
              ),
            )
          : {
              ...currentVersions,
              [input.skillKey]:
                input.version ??
                (() => {
                  throw new Error("version is required when remove is false")
                })(),
            }),
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
  await ensureTenantSystemManagedSkillsForTenant(input)

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
  await ensureTenantSystemManagedSkillsForTenant({
    tenantId: input.tenantId,
  })

  const db = getDb()

  const [skill] = await db
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
      summary: tenantSkillVersions.summary,
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
      fileKind: tenantSkillFiles.fileKind,
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
    description: skill.description,
    displayName: skill.displayName,
    enabled: skill.enabled,
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
      fileClass:
        file.fileKind === "managed_entry" ? "managed_entry" : "managed_seeded",
      path: file.relativePath,
      resettable: file.fileKind === "managed_seeded",
      storageEncoding:
        file.contentEncoding === "utf8_text" ? "utf8_text" : "binary",
    })),
    skillId: skill.skillId,
    skillKey: skill.skillKey,
    sourceType: skill.sourceType,
    status: skill.status,
    summary: latestVersion.summary,
    updatedAt: skill.updatedAt,
    version: latestVersion.version,
  }
}

async function ensureTenantSystemManagedSkillsForTenant(input: {
  tenantId: string
}) {
  const db = getDb()

  for (const definition of SYSTEM_MANAGED_SKILL_DEFINITIONS) {
    const [skill] = await db
      .select({
        skillId: tenantSkills.id,
        sourceType: tenantSkills.sourceType,
      })
      .from(tenantSkills)
      .where(
        and(
          eq(tenantSkills.tenantId, input.tenantId),
          eq(tenantSkills.skillKey, definition.skillKey),
        ),
      )
      .limit(1)

    if (!skill) {
      await createSystemManagedSkillForTenant({
        files: definition.files,
        skillKey: definition.skillKey,
        summary: definition.summary,
        tenantId: input.tenantId,
      })
      continue
    }

    if (skill.sourceType !== "system") {
      continue
    }
  }
}

async function createSystemManagedSkillForTenant(input: {
  files: Array<{
    contentText?: string | null
    path: string
  }>
  skillKey: string
  summary: string
  tenantId: string
}) {
  const db = getDb()
  const entryFile = input.files.find((file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH)

  if (typeof entryFile?.contentText !== "string") {
    throw new Error(
      `System managed skill ${input.skillKey} is missing SKILL.md in its canonical package.`,
    )
  }

  const parsed = parseManagedSkillDocument(entryFile.contentText)

  const [createdSkill] = await db
    .insert(tenantSkills)
    .values({
      createdByExternalId: null,
      createdByType: "system",
      dependsOnJson: {
        integrations: parsed.integrationKeys,
        skills: parsed.skillKeys,
      },
      description: parsed.description,
      displayName: parsed.name,
      enabled: true,
      skillKey: input.skillKey,
      sourceType: "system",
      status: "ready",
      tenantId: input.tenantId,
      updatedByExternalId: null,
      updatedByType: "system",
    })
    .returning({
      id: tenantSkills.id,
      skillKey: tenantSkills.skillKey,
    })

  const [createdVersion] = await db
    .insert(tenantSkillVersions)
    .values({
      createdByExternalId: null,
      createdByType: "system",
      summary: input.summary,
      tenantSkillId: createdSkill.id,
      version: 1,
    })
    .returning({
      id: tenantSkillVersions.id,
      version: tenantSkillVersions.version,
    })

  const managedFiles = input.files
    .filter((file): file is { contentText: string; path: string } => typeof file.contentText === "string")
    .map((file) => ({
      contentEncoding: "utf8_text" as const,
      contentSha256: createTextChecksum(file.contentText),
      contentText: file.contentText,
      contentType: "text/plain; charset=utf-8",
      fileKind:
        file.path === MANAGED_SKILL_ENTRY_FILE_PATH ? "managed_entry" : "managed_seeded",
      path: file.path,
    }))

  const insertedFiles = await db
    .insert(tenantSkillFiles)
    .values(
      managedFiles.map((file) => ({
        contentEncoding: file.contentEncoding,
        contentSha256: file.contentSha256,
        contentType: file.contentType,
        fileKind: file.fileKind,
        lastSeenAt: null,
        relativePath: file.path,
        tenantSkillId: createdSkill.id,
      })),
    )
    .returning({
      id: tenantSkillFiles.id,
      relativePath: tenantSkillFiles.relativePath,
    })

  const insertedFilesByPath = new Map(
    insertedFiles.map((file) => [file.relativePath, file.id]),
  )

  await db.insert(tenantSkillFileVersions).values(
    managedFiles.map((file) => ({
      contentSha256: file.contentSha256,
      contentText: file.contentText,
      createdByExternalId: null,
      createdByType: "system" as const,
      tenantSkillFileId:
        insertedFilesByPath.get(file.path) ??
        (() => {
          throw new Error(`Inserted managed file missing for ${file.path}`)
        })(),
      tenantSkillVersionId: createdVersion.id,
      version: createdVersion.version,
    })),
  )
}

export async function createTenantManagedSkillForTenant(input: {
  contentText?: string
  createdByExternalId?: string | null
  createdByType: "runtime" | "user"
  description?: string
  integrationKeys?: string[]
  skillBody?: string
  skillKey: string
  skillKeys?: string[]
  summary?: string
  tenantId: string
}) {
  const db = getDb()
  const contentText = buildManagedSkillContent({
    contentText: input.contentText,
    description: input.description,
    integrationKeys: input.integrationKeys,
    skillBody: input.skillBody,
    skillKey: input.skillKey,
    skillKeys: input.skillKeys,
  })
  const parsed = parseManagedSkillDocument(contentText)

  const [createdSkill] = await db
    .insert(tenantSkills)
    .values({
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      dependsOnJson: {
        integrations: parsed.integrationKeys,
        skills: parsed.skillKeys,
      },
      description: parsed.description,
      displayName: parsed.name,
      enabled: true,
      skillKey: input.skillKey,
      sourceType: "user",
      status: "ready",
      tenantId: input.tenantId,
      updatedByExternalId: input.createdByExternalId ?? null,
      updatedByType: input.createdByType,
    })
    .returning({
      id: tenantSkills.id,
      skillKey: tenantSkills.skillKey,
    })

  const [createdVersion] = await db
    .insert(tenantSkillVersions)
    .values({
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      summary: input.summary ?? `Created ${input.skillKey}`,
      tenantSkillId: createdSkill.id,
      version: 1,
    })
    .returning({
      id: tenantSkillVersions.id,
      version: tenantSkillVersions.version,
    })

  const [createdFile] = await db
    .insert(tenantSkillFiles)
    .values({
      contentEncoding: "utf8_text",
      contentSha256: createTextChecksum(contentText),
      contentType: "text/markdown; charset=utf-8",
      fileKind: "managed",
      lastSeenAt: null,
      relativePath: MANAGED_SKILL_ENTRY_FILE_PATH,
      tenantSkillId: createdSkill.id,
    })
    .returning({
      id: tenantSkillFiles.id,
    })

  await db.insert(tenantSkillFileVersions).values({
    contentSha256: createTextChecksum(contentText),
    contentText,
    createdByExternalId: input.createdByExternalId ?? null,
    createdByType: input.createdByType,
    tenantSkillFileId: createdFile.id,
    tenantSkillVersionId: createdVersion.id,
    version: createdVersion.version,
  })

  const desiredStateVersion = await createNextDesiredStateVersionForManagedSkills(
    {
      skillKey: createdSkill.skillKey,
      tenantId: input.tenantId,
      version: createdVersion.version,
    },
  )
  const tenantRuntime = await getTenantRuntimeState(input.tenantId)

  return {
    applyQueued: tenantRuntime.isRuntimeReady,
    desiredStateVersion: desiredStateVersion.version,
    skillKey: createdSkill.skillKey,
    version: createdVersion.version,
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

export async function updateTenantManagedSkillForTenant(input: {
  createdByExternalId?: string | null
  createdByType: "runtime" | "user"
  expectedVersion?: number
  patch: ManagedSkillPatch
  skillKey: string
  summary?: string
  tenantId: string
}) {
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

  const currentContent = getManagedSkillEntryContent(detail)
  const nextContent = buildNextManagedSkillContent({
    currentContent,
    patch: input.patch,
    skillKey: detail.skillKey,
  })

  let changed = false
  let currentVersion = detail.version

  if (nextContent !== currentContent) {
    const updated = await updateTenantManagedSkillTextFileForTenant({
      contentText: nextContent,
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      expectedVersion: currentVersion,
      relativePath: MANAGED_SKILL_ENTRY_FILE_PATH,
      skillKey: detail.skillKey,
      summary: input.summary,
      tenantId: input.tenantId,
    })

    changed = changed || updated.changed
    currentVersion = updated.currentVersion
  }

  const nextEnabled = input.patch.enabled ?? detail.enabled

  if (nextEnabled !== detail.enabled) {
    const db = getDb()
    await db
      .update(tenantSkills)
      .set({
        enabled: nextEnabled,
        status: nextEnabled ? "ready" : "disabled",
        updatedAt: new Date(),
        updatedByExternalId: input.createdByExternalId ?? null,
        updatedByType: input.createdByType,
      })
      .where(eq(tenantSkills.id, detail.skillId))

    changed = true
  }

  if (!changed) {
    return {
      applyQueued: false,
      changed: false,
      currentVersion,
      skillKey: detail.skillKey,
    }
  }

  const desiredStateVersion = await createNextDesiredStateVersionForManagedSkills(
    {
      skillKey: detail.skillKey,
      tenantId: input.tenantId,
      version: currentVersion,
    },
  )
  const tenantRuntime = await getTenantRuntimeState(input.tenantId)

  return {
    applyQueued: tenantRuntime.isRuntimeReady,
    changed: true,
    currentVersion,
    desiredStateVersion: desiredStateVersion.version,
    skillKey: detail.skillKey,
  }
}

export async function deleteTenantManagedSkillForTenant(input: {
  createdByExternalId?: string | null
  createdByType: "runtime" | "user"
  expectedVersion: number
  skillKey: string
  summary?: string
  tenantId: string
}) {
  const detail = await getLatestTenantManagedSkillDetailForTenant({
    skillKey: input.skillKey,
    tenantId: input.tenantId,
  })

  if (!detail) {
    throw new Error(
      `Managed skill ${input.skillKey} does not exist for this workspace.`,
    )
  }

  if (detail.version !== input.expectedVersion) {
    throw new ManagedSkillVersionConflictError(
      input.expectedVersion,
      detail.version,
    )
  }

  const db = getDb()
  await db.delete(tenantSkills).where(eq(tenantSkills.id, detail.skillId))

  const desiredStateVersion = await createNextDesiredStateVersionForManagedSkills(
    {
      remove: true,
      skillKey: detail.skillKey,
      tenantId: input.tenantId,
    },
  )
  const tenantRuntime = await getTenantRuntimeState(input.tenantId)

  return {
    applyQueued: tenantRuntime.isRuntimeReady,
    deleted: true,
    desiredStateVersion: desiredStateVersion.version,
    skillKey: detail.skillKey,
  }
}

export async function resetTenantManagedSkillPackageForTenant(input: {
  createdByExternalId?: string | null
  createdByType: "runtime" | "user"
  expectedVersion?: number
  scope: "companion_files"
  skillKey: string
  summary?: string
  tenantId: string
}) {
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

  const desiredStateVersion = await createNextDesiredStateVersionForManagedSkills(
    {
      skillKey: detail.skillKey,
      tenantId: input.tenantId,
      version: detail.version,
    },
  )
  const tenantRuntime = await getTenantRuntimeState(input.tenantId)

  if (tenantRuntime.isRuntimeReady) {
    await enqueueJob({
      jobType: JOB_TYPES.applyTenantConfig,
      payload: {
        desiredStateVersion: desiredStateVersion.version,
        managedSkillResetOperations: [
          {
            scope: input.scope,
            skillKey: detail.skillKey,
          },
        ],
        tenantId: input.tenantId,
      },
    })
  }

  return {
    applyQueued: tenantRuntime.isRuntimeReady,
    desiredStateVersion: desiredStateVersion.version,
    resetScope: input.scope,
    skillKey: detail.skillKey,
  }
}

function getManagedSkillEntryContent(detail: ManagedSkillDetail) {
  const entryFile = detail.files.find(
    (file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH,
  )

  if (
    !entryFile ||
    entryFile.storageEncoding !== "utf8_text" ||
    typeof entryFile.contentText !== "string"
  ) {
    throw new Error(
      `Managed skill ${detail.skillKey} is missing a readable SKILL.md entry file.`,
    )
  }

  return entryFile.contentText
}

function buildManagedSkillContent(input: {
  contentText?: string
  description?: string
  integrationKeys?: string[]
  skillBody?: string
  skillKey: string
  skillKeys?: string[]
}) {
  if (typeof input.contentText === "string") {
    return input.contentText
  }

  if (
    typeof input.description !== "string" ||
    typeof input.skillBody !== "string"
  ) {
    throw new Error(
      "Creating a managed skill requires contentText or both description and skillBody.",
    )
  }

  return buildManagedSkillMarkdown({
    description: input.description,
    integrationKeys: input.integrationKeys ?? [],
    name: input.skillKey,
    skillBody: input.skillBody,
    skillKeys: input.skillKeys ?? [],
  })
}

function buildNextManagedSkillContent(input: {
  currentContent: string
  patch: ManagedSkillPatch
  skillKey: string
}) {
  const hasStructuredPatch =
    typeof input.patch.description === "string" ||
    typeof input.patch.skillBody === "string" ||
    Array.isArray(input.patch.integrationKeys) ||
    Array.isArray(input.patch.skillKeys)

  if (typeof input.patch.contentText === "string" && hasStructuredPatch) {
    throw new Error(
      "contentText cannot be combined with structured managed skill patch fields.",
    )
  }

  if (typeof input.patch.contentText === "string") {
    return input.patch.contentText
  }

  if (!hasStructuredPatch) {
    return input.currentContent
  }

  const current = parseManagedSkillDocument(input.currentContent)

  return buildManagedSkillMarkdown({
    description: input.patch.description ?? current.description,
    integrationKeys: input.patch.integrationKeys ?? current.integrationKeys,
    name: input.skillKey,
    skillBody: input.patch.skillBody ?? current.skillBody,
    skillKeys: input.patch.skillKeys ?? current.skillKeys,
  })
}

function parseManagedSkillDocument(contentText: string): ParsedManagedSkillDocument {
  const normalized = contentText.replace(/\r\n/g, "\n")
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

  if (!frontmatterMatch) {
    throw new Error("SKILL.md must include YAML frontmatter.")
  }

  const frontmatter = frontmatterMatch[1]
  const body = frontmatterMatch[2]?.trim() ?? ""
  const lines = frontmatter.split("\n")
  const name = getFrontmatterScalar(lines, "name")
  const description = getFrontmatterScalar(lines, "description")

  if (!name || !description) {
    throw new Error("SKILL.md must include non-empty name and description.")
  }

  return {
    description,
    integrationKeys: getFrontmatterList(lines, "integrations"),
    name,
    skillBody: body,
    skillKeys: getFrontmatterList(lines, "skills"),
  }
}

function getFrontmatterScalar(lines: string[], key: string) {
  const prefix = `${key}:`
  const line = lines.find((entry) => entry.trimStart().startsWith(prefix))
  return line ? line.split(":").slice(1).join(":").trim() : ""
}

function getFrontmatterList(lines: string[], key: string) {
  const startIndex = lines.findIndex(
    (entry) => entry.trim() === `${key}:` || entry.trim() === `${key}: []`,
  )

  if (startIndex === -1) {
    return []
  }

  if (lines[startIndex].trim() === `${key}: []`) {
    return []
  }

  const values: string[] = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed.startsWith("- ")) {
      break
    }

    values.push(trimmed.slice(2).trim())
  }

  return values
}

function buildManagedSkillMarkdown(input: {
  description: string
  integrationKeys: string[]
  name: string
  skillBody: string
  skillKeys: string[]
}) {
  const normalizedIntegrationKeys = [...new Set(input.integrationKeys)]
    .map((integrationKey) => integrationKey.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
  const normalizedSkillKeys = [...new Set(input.skillKeys)]
    .map((skillKey) => skillKey.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
  const lines = [
    "---",
    `name: ${input.name.trim()}`,
    `description: ${input.description.trim()}`,
    "metadata:",
    "  dependsOn:",
  ]

  if (normalizedIntegrationKeys.length === 0) {
    lines.push("    integrations: []")
  } else {
    lines.push("    integrations:")
    for (const integrationKey of normalizedIntegrationKeys) {
      lines.push(`      - ${integrationKey}`)
    }
  }

  if (normalizedSkillKeys.length === 0) {
    lines.push("    skills: []")
  } else {
    lines.push("    skills:")
    for (const skillKey of normalizedSkillKeys) {
      lines.push(`      - ${skillKey}`)
    }
  }

  lines.push("---", "", input.skillBody.trim(), "")

  return `${lines.join("\n")}`
}
