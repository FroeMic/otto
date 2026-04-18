import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  creditLedgerEntries,
  jobEvents,
  jobRuns,
  organizations,
  tenantDesiredStates,
  tenantServers,
  tenants,
  users,
  workspaceOnboardingRuns,
} from "@otto/feature-integrations-runtime/db/schema"
import { desc, eq } from "drizzle-orm"

import { buildInitialWorkspaceCreditGrantInput } from "../billing/data"
import { CREDIT_LEDGER_ENTRY_TYPES } from "../billing/credit-pricing"
import { JOB_TYPES } from "../jobs/types"
import { ensureTenantManagedConfigDesiredState } from "../runtime/managed-config/data"
import { syncDefaultTenantManagedSkillsForTenant } from "../runtime/managed-skills-data"

export type InitialWorkspaceRuntimeProvisioningStrategy = "legacy_base_image"

type InitialWorkspaceOttoPluginConfig = {
  config?: Record<string, unknown>
  id: string
  timeoutMs?: number
}

const REQUIRED_INITIAL_WORKSPACE_OTTO_PLUGIN_IDS = [
  "otto-workspace-chat",
] as const

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseInitialWorkspaceOttoPlugins(
  value: unknown,
): InitialWorkspaceOttoPluginConfig[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      return []
    }

    return [
      {
        ...(isRecord(entry.config) ? { config: entry.config } : {}),
        id: entry.id,
        ...(typeof entry.timeoutMs === "number" && Number.isFinite(entry.timeoutMs)
          ? { timeoutMs: entry.timeoutMs }
          : {}),
      },
    ]
  })
}

function hasRequiredInitialWorkspaceOttoPlugins(configJson: unknown) {
  if (!isRecord(configJson)) {
    return false
  }

  const pluginIds = new Set(
    parseInitialWorkspaceOttoPlugins(configJson.ottoPlugins).map(
      (plugin) => plugin.id,
    ),
  )

  return REQUIRED_INITIAL_WORKSPACE_OTTO_PLUGIN_IDS.every((pluginId) =>
    pluginIds.has(pluginId),
  )
}

export function buildInitialWorkspaceDesiredStateConfig(configJson: unknown) {
  const currentConfig = isRecord(configJson) ? { ...configJson } : {}
  const ottoPlugins = parseInitialWorkspaceOttoPlugins(
    currentConfig.ottoPlugins,
  )
  const pluginIds = new Set(ottoPlugins.map((plugin) => plugin.id))

  for (const pluginId of REQUIRED_INITIAL_WORKSPACE_OTTO_PLUGIN_IDS) {
    if (!pluginIds.has(pluginId)) {
      ottoPlugins.push({ id: pluginId })
    }
  }

  return {
    ...currentConfig,
    ottoPlugins,
  }
}

export function buildInitialWorkspaceRuntimeProvisioningJobInput(input: {
  provisioningStrategy?: InitialWorkspaceRuntimeProvisioningStrategy
  tenantId: string
}) {
  return {
    jobType: JOB_TYPES.provisionTenantServer,
    payloadJson: {
      step: "create_server",
      tenantId: input.tenantId,
    },
    tenantServer: {
      provider: "hetzner",
      provisioningStrategy: input.provisioningStrategy ?? "legacy_base_image",
      sshUsername: "openclaw",
      status: "creating",
    },
  } as const
}

export function buildWorkspaceOnboardingProvisioningPatch(input: {
  jobId: string | null
  now: Date
  tenantId: string
}) {
  return {
    currentStepKey: null,
    initialProvisioningJobId: input.jobId,
    initialTenantId: input.tenantId,
    provisioningStartedAt: input.now,
    status: "provisioning",
    updatedAt: input.now,
  } as const
}

export function buildPlatformWorkspaceOnboardingProvisioningInsert(input: {
  jobId: string | null
  now: Date
  organizationId: string
  starterPrompt?: string | null
  tenantId: string
  userId: string
}) {
  return {
    answersJson: {},
    currentStepKey: null,
    flowKey: "workspace_onboarding",
    flowVersion: 1,
    initialProvisioningJobId: input.jobId,
    initialTenantId: input.tenantId,
    organizationId: input.organizationId,
    provisioningStartedAt: input.now,
    starterPrompt: input.starterPrompt ?? "",
    status: "provisioning",
    updatedAt: input.now,
    userId: input.userId,
    waitlistDecision: "accepted",
  } as const
}

async function ensureInitialWorkspaceCreditsInTransaction(input: {
  tenantId: string
  tx: DbTransaction
}) {
  const grantInput = buildInitialWorkspaceCreditGrantInput({
    tenantId: input.tenantId,
  })

  await input.tx
    .insert(creditLedgerEntries)
    .values({
      billableUnits: 0,
      creditsDeltaMilli: grantInput.creditsDeltaMilli,
      description: grantInput.description,
      entryType: CREDIT_LEDGER_ENTRY_TYPES.manualGrant,
      sourceId: grantInput.sourceId,
      sourceType: grantInput.sourceType,
      tenantId: input.tenantId,
    })
    .onConflictDoNothing({
      target: [
        creditLedgerEntries.sourceType,
        creditLedgerEntries.sourceId,
        creditLedgerEntries.entryType,
      ],
    })
}

async function ensureInitialTenantDesiredState(tenantId: string) {
  await ensureTenantManagedConfigDesiredState({ tenantId })
  await syncDefaultTenantManagedSkillsForTenant({ tenantId })

  const db = getDb()
  const [latestDesiredState] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1)

  if (
    latestDesiredState &&
    hasRequiredInitialWorkspaceOttoPlugins(latestDesiredState.configJson)
  ) {
    return latestDesiredState.version
  }

  const configJson = buildInitialWorkspaceDesiredStateConfig(
    latestDesiredState?.configJson,
  )
  const [createdDesiredState] = await db
    .insert(tenantDesiredStates)
    .values({
      configJson,
      tenantId,
      version: (latestDesiredState?.version ?? 0) + 1,
    })
    .returning({
      version: tenantDesiredStates.version,
    })

  return createdDesiredState?.version ?? 1
}

export async function ensureInitialWorkspaceRuntimeProvisioning(input: {
  createOrUpdateOnboardingRunForUserExternalId?: string | null
  failIfTenantServerExists?: boolean
  onboardingRunId?: string | null
  organizationId: string
  provisioningStrategy?: InitialWorkspaceRuntimeProvisioningStrategy
  starterPrompt?: string | null
}) {
  const db = getDb()
  const provisioningStrategy =
    input.provisioningStrategy ?? "legacy_base_image"

  const tenantContext = await db.transaction(async (tx) => {
    const [organization] = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
      })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1)

    if (!organization) {
      throw new Error("Organization not found")
    }

    const [onboardingUser] =
      input.createOrUpdateOnboardingRunForUserExternalId
        ? await tx
            .select({
              id: users.id,
            })
            .from(users)
            .where(
              eq(
                users.externalId,
                input.createOrUpdateOnboardingRunForUserExternalId,
              ),
            )
            .limit(1)
        : [null]

    if (
      input.createOrUpdateOnboardingRunForUserExternalId &&
      !onboardingUser
    ) {
      throw new Error("Platform user not found")
    }

    const [latestTenant] = await tx
      .select({
        id: tenants.id,
        name: tenants.name,
        serverId: tenantServers.id,
      })
      .from(tenants)
      .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
      .where(eq(tenants.organizationId, organization.id))
      .orderBy(desc(tenants.createdAt))
      .limit(1)

    if (latestTenant?.serverId && input.failIfTenantServerExists) {
      throw new Error("Organization already has a tenant server")
    }

    let tenantId = latestTenant?.id ?? null
    let tenantName = latestTenant?.name ?? organization.name
    let provisionedTenant = false

    if (!tenantId) {
      const [createdTenant] = await tx
        .insert(tenants)
        .values({
          name: organization.name,
          organizationId: organization.id,
          status: "provisioning",
        })
        .returning({
          id: tenants.id,
          name: tenants.name,
        })

      if (!createdTenant) {
        throw new Error("Failed to create tenant")
      }

      tenantId = createdTenant.id
      tenantName = createdTenant.name
      provisionedTenant = true
    } else {
      await tx
        .update(tenants)
        .set({
          status: "provisioning",
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId))
    }

    await ensureInitialWorkspaceCreditsInTransaction({ tenantId, tx })

    return {
      onboardingUserId: onboardingUser?.id ?? null,
      organizationId: organization.id,
      provisionedTenant,
      tenantId,
      tenantName,
    }
  })

  await ensureInitialTenantDesiredState(tenantContext.tenantId)

  return db.transaction(async (tx) => {
    const [existingServer] = await tx
      .select({
        id: tenantServers.id,
      })
      .from(tenantServers)
      .where(eq(tenantServers.tenantId, tenantContext.tenantId))
      .limit(1)

    if (existingServer?.id && input.failIfTenantServerExists) {
      throw new Error("Organization already has a tenant server")
    }

    let jobId: string | null = null

    if (!existingServer) {
      const provisioningJob = buildInitialWorkspaceRuntimeProvisioningJobInput({
        provisioningStrategy,
        tenantId: tenantContext.tenantId,
      })

      await tx.insert(tenantServers).values({
        ...provisioningJob.tenantServer,
        tenantId: tenantContext.tenantId,
      })

      const [job] = await tx
        .insert(jobRuns)
        .values({
          availableAt: new Date(),
          jobType: provisioningJob.jobType,
          payloadJson: provisioningJob.payloadJson,
          status: "queued",
          tenantId: tenantContext.tenantId,
        })
        .returning({
          id: jobRuns.id,
        })

      if (!job) {
        throw new Error("Failed to queue provisioning job")
      }

      jobId = job.id

      await tx.insert(jobEvents).values({
        dataJson: {
          jobType: provisioningJob.jobType,
        },
        eventType: "queued",
        jobRunId: job.id,
        message: "Job queued for execution",
      })
    }

    const now = new Date()
    const provisioningPatch = buildWorkspaceOnboardingProvisioningPatch({
      jobId,
      now,
      tenantId: tenantContext.tenantId,
    })
    const onboardingUpdate =
      jobId === null
        ? {
            currentStepKey: provisioningPatch.currentStepKey,
            initialTenantId: provisioningPatch.initialTenantId,
            provisioningStartedAt: provisioningPatch.provisioningStartedAt,
            status: provisioningPatch.status,
            updatedAt: provisioningPatch.updatedAt,
          }
        : provisioningPatch

    if (input.onboardingRunId) {
      await tx
        .update(workspaceOnboardingRuns)
        .set(onboardingUpdate)
        .where(eq(workspaceOnboardingRuns.id, input.onboardingRunId))
    }

    if (tenantContext.onboardingUserId) {
      const insertValues = buildPlatformWorkspaceOnboardingProvisioningInsert({
        jobId,
        now,
        organizationId: tenantContext.organizationId,
        starterPrompt: input.starterPrompt,
        tenantId: tenantContext.tenantId,
        userId: tenantContext.onboardingUserId,
      })

      await tx
        .insert(workspaceOnboardingRuns)
        .values(insertValues)
        .onConflictDoUpdate({
          set: onboardingUpdate,
          target: [
            workspaceOnboardingRuns.userId,
            workspaceOnboardingRuns.organizationId,
          ],
        })
    }

    return {
      jobId,
      provisionedTenant: tenantContext.provisionedTenant,
      provisioningStrategy,
      queued: jobId !== null,
      tenantId: tenantContext.tenantId,
      tenantName: tenantContext.tenantName,
    }
  })
}
