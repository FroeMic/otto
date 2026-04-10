import { createHash } from "node:crypto"

import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  organizations,
  tenantDesiredStates,
  tenantManagedConfigVersions,
  tenantManagedFileVersions,
  tenantServers,
  tenants,
} from "@otto/feature-integrations-runtime/db/schema"
import { getControlPlaneBaseUrl } from "@otto/feature-integrations-runtime/lib/env"
import { and, desc, eq } from "drizzle-orm"

import { enqueueJob } from "../jobs/queue"
import {
  buildManagedBootstrapFileContent,
  getManagedBootstrapFileDefinitions,
  type ManagedBootstrapFilePath,
  normalizeManagedBootstrapFilePath,
} from "./managed-config-definition"

export class ManagedConfigVersionConflictError extends Error {
  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `Managed config version mismatch: expected ${expectedVersion}, current ${currentVersion}`,
    )
  }
}

function createManagedFileChecksum(input: {
  path: ManagedBootstrapFilePath
  sharedContent: string
  systemContent: string
  workspaceSlug?: string | null
}) {
  return createHash("sha256")
    .update(
      buildManagedBootstrapFileContent({
        path: input.path,
        runtimeContext: {
          ottoBaseUrl: getControlPlaneBaseUrl(),
          workspaceSlug: input.workspaceSlug ?? null,
        },
        sharedContent: input.sharedContent,
        systemContent: input.systemContent,
      }),
    )
    .digest("hex")
}

async function getOrganizationSlugForTenant(tenantId: string) {
  const db = getDb()
  const [organization] = await db
    .select({
      slug: organizations.slug,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .where(eq(tenants.id, tenantId))
    .limit(1)

  return organization?.slug ?? null
}

async function ensureLatestTenantManagedConfigVersion(tenantId: string) {
  const db = getDb()
  const [existingVersion] = await db
    .select({
      id: tenantManagedConfigVersions.id,
      version: tenantManagedConfigVersions.version,
    })
    .from(tenantManagedConfigVersions)
    .where(eq(tenantManagedConfigVersions.tenantId, tenantId))
    .orderBy(desc(tenantManagedConfigVersions.version))
    .limit(1)

  if (existingVersion) {
    return existingVersion
  }

  const workspaceSlug = await getOrganizationSlugForTenant(tenantId)
  const [createdVersion] = await db
    .insert(tenantManagedConfigVersions)
    .values({
      createdByType: "system",
      summary: "Seeded initial managed bootstrap files",
      tenantId,
      version: 1,
    })
    .returning({
      id: tenantManagedConfigVersions.id,
      version: tenantManagedConfigVersions.version,
    })

  await db.insert(tenantManagedFileVersions).values(
    getManagedBootstrapFileDefinitions().map((definition) => ({
      checksum: createManagedFileChecksum({
        path: definition.path,
        sharedContent: definition.defaultSharedContent,
        systemContent: definition.systemContent,
        workspaceSlug,
      }),
      path: definition.path,
      sharedContent: definition.defaultSharedContent,
      systemContent: definition.systemContent,
      tenantManagedConfigVersionId: createdVersion.id,
    })),
  )

  return createdVersion
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
    tenantId: tenantRow.tenantId,
  }
}

async function createNextDesiredStateVersionForManagedConfig(input: {
  managedConfigVersion: number
  tenantId: string
}) {
  const db = getDb()
  const latestDesiredState = await getLatestDesiredState(input.tenantId)
  const nextVersion = (latestDesiredState?.version ?? 0) + 1
  const currentConfig =
    latestDesiredState?.configJson &&
    typeof latestDesiredState.configJson === "object" &&
    !Array.isArray(latestDesiredState.configJson)
      ? { ...latestDesiredState.configJson }
      : {}

  const configJson = {
    ...currentConfig,
    managedConfigVersion: input.managedConfigVersion,
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

export async function getLatestTenantManagedConfig(tenantId: string) {
  const db = getDb()
  const latestVersion = await ensureLatestTenantManagedConfigVersion(tenantId)
  const workspaceSlug = await getOrganizationSlugForTenant(tenantId)
  const [configVersion] = await db
    .select({
      id: tenantManagedConfigVersions.id,
      version: tenantManagedConfigVersions.version,
    })
    .from(tenantManagedConfigVersions)
    .where(
      and(
        eq(tenantManagedConfigVersions.tenantId, tenantId),
        eq(tenantManagedConfigVersions.version, latestVersion.version),
      ),
    )
    .limit(1)

  if (!configVersion) {
    throw new Error(
      `Managed config version ${latestVersion.version} not found for tenant ${tenantId}`,
    )
  }

  const fileRows = await db
    .select({
      checksum: tenantManagedFileVersions.checksum,
      path: tenantManagedFileVersions.path,
      sharedContent: tenantManagedFileVersions.sharedContent,
      systemContent: tenantManagedFileVersions.systemContent,
    })
    .from(tenantManagedFileVersions)
    .where(
      eq(
        tenantManagedFileVersions.tenantManagedConfigVersionId,
        configVersion.id,
      ),
    )

  const rowsByPath = new Map(fileRows.map((row) => [row.path, row]))

  return {
    files: getManagedBootstrapFileDefinitions().map((definition) => {
      const row = rowsByPath.get(definition.path)
      const sharedContent =
        row?.sharedContent ?? definition.defaultSharedContent
      const systemContent = row?.systemContent ?? definition.systemContent

      return {
        checksum:
          row?.checksum ??
          createManagedFileChecksum({
            path: definition.path,
            sharedContent,
            systemContent,
            workspaceSlug,
          }),
        content: buildManagedBootstrapFileContent({
          path: definition.path,
          runtimeContext: {
            ottoBaseUrl: getControlPlaneBaseUrl(),
            workspaceSlug,
          },
          sharedContent,
          systemContent,
        }),
        description: definition.description,
        label: definition.label,
        path: definition.path,
        sharedContent,
        systemContent,
      }
    }),
    version: configVersion.version,
  }
}

export async function updateTenantManagedFileSharedContentForTenant(input: {
  createdByExternalId?: string | null
  createdByType: "runtime" | "user"
  expectedVersion?: number
  filePath: ManagedBootstrapFilePath
  sharedContent: string
  summary?: string
  tenantId: string
}) {
  const db = getDb()
  const normalizedSharedContent = input.sharedContent.trim()

  if (!normalizedSharedContent) {
    throw new Error("Shared managed content cannot be empty")
  }

  const latestConfig = await getLatestTenantManagedConfig(input.tenantId)

  if (
    input.expectedVersion !== undefined &&
    latestConfig.version !== input.expectedVersion
  ) {
    throw new ManagedConfigVersionConflictError(
      input.expectedVersion,
      latestConfig.version,
    )
  }

  const targetFile = latestConfig.files.find(
    (file) => file.path === input.filePath,
  )

  if (!targetFile) {
    throw new Error(`Managed file ${input.filePath} is missing`)
  }

  if (targetFile.sharedContent === normalizedSharedContent) {
    return {
      applyQueued: false,
      changed: false,
      currentVersion: latestConfig.version,
    }
  }

  const workspaceSlug = await getOrganizationSlugForTenant(input.tenantId)
  const [createdVersion] = await db
    .insert(tenantManagedConfigVersions)
    .values({
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      summary: input.summary ?? `Updated ${input.filePath}`,
      tenantId: input.tenantId,
      version: latestConfig.version + 1,
    })
    .returning({
      id: tenantManagedConfigVersions.id,
      version: tenantManagedConfigVersions.version,
    })

  await db.insert(tenantManagedFileVersions).values(
    latestConfig.files.map((file) => {
      const sharedContent =
        file.path === input.filePath
          ? normalizedSharedContent
          : file.sharedContent

      return {
        checksum: createManagedFileChecksum({
          path: file.path,
          sharedContent,
          systemContent: file.systemContent,
          workspaceSlug,
        }),
        path: file.path,
        sharedContent,
        systemContent: file.systemContent,
        tenantManagedConfigVersionId: createdVersion.id,
      }
    }),
  )

  const desiredStateVersion =
    await createNextDesiredStateVersionForManagedConfig({
      managedConfigVersion: createdVersion.version,
      tenantId: input.tenantId,
    })
  const tenantRuntime = await getTenantRuntimeState(input.tenantId)

  if (tenantRuntime.isRuntimeReady) {
    await enqueueJob({
      jobType: "sync_tenant_sessions",
      payload: {
        tenantId: input.tenantId,
      },
    }).catch(() => undefined)
  }

  return {
    applyQueued: tenantRuntime.isRuntimeReady,
    changed: true,
    currentVersion: createdVersion.version,
    desiredStateVersion: desiredStateVersion.version,
    managedConfigVersion: createdVersion.version,
  }
}

export { normalizeManagedBootstrapFilePath }
