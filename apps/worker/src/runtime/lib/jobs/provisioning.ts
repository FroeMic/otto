import { eq } from "drizzle-orm"

import { getDb } from "../../db/client"
import {
  ensureCurrentTenantDesiredStateVersion,
  ensureTenantRuntimeGatewayToken,
  ensureTenantRuntimeTenantToken,
  getLatestTenantDesiredState,
  getLatestTenantManagedConfig,
  getManagedConfigVersionFromConfigJson,
  getManagedSkillVersionMapFromConfigJson,
  getTenantManagedConfigByVersion,
  getTenantSlackBotToken,
} from "../../db/control-plane"
import {
  listLatestTenantManagedSkillVersionMapForTenant,
  listProjectedManagedSkillFilesForTenant,
} from "../../db/managed-skills"
import {
  getProviderAccountByTenantAndKey,
  getTenantOpenAiApiKey,
  PROVIDER_CREDENTIAL_TYPES,
  persistProvisionedProviderCredential,
} from "../../db/provider-accounts"
import { organizations, tenantServers, tenants } from "../../db/schema"
import { getEnv } from "../env"
import { renderCloudInit } from "../hetzner/cloud-init"
import { buildOpenClawTenantConfig } from "../openclaw/config"
import { OpenAiProvisioner } from "../providers/openai/provisioning"
import type { ProvisioningProvider } from "../provisioning-provider/interface"
import { resolveProvisioningProvider } from "../provisioning-provider/resolver"
import { RuntimeManager } from "../runtime/manager"
import { SshClient } from "../ssh/client"

import {
  appendJobEvent,
  enqueueJob,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "./queue"
import {
  type ClaimedJob,
  JOB_TYPES,
  PROVISIONING_STEPS,
  type ProvisioningStep,
  type ProvisionTenantServerPayload,
} from "./types"

const openAiProvisioner = new OpenAiProvisioner()
const runtimeManager = new RuntimeManager()
const sshClient = new SshClient()
const STEP_DELAY_MS = 10_000

export async function processProvisionTenantServerJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.provisionTenantServer) {
    throw new Error(
      `Unsupported job type for provisioning handler: ${job.jobType}`,
    )
  }

  const payload = parseProvisionPayload(job.payload)
  logStep(job.id, payload.tenantId, payload.step, "starting")

  try {
    switch (payload.step) {
      case PROVISIONING_STEPS.createServer:
        await createServer(job.id, payload)
        return
      case PROVISIONING_STEPS.waitForHetznerAction:
        await waitForServerAction(job.id, payload)
        return
      case PROVISIONING_STEPS.fetchServerIp:
        await fetchServerIp(job.id, payload)
        return
      case PROVISIONING_STEPS.waitForSsh:
        await waitForSsh(job.id, payload)
        return
      case PROVISIONING_STEPS.waitForHostBootstrap:
        await waitForHostBootstrap(job.id, payload)
        return
      case PROVISIONING_STEPS.bootstrapRuntime:
        await bootstrapRuntime(job.id, payload)
        return
      case PROVISIONING_STEPS.startRuntime:
        await startRuntime(job.id, payload)
        return
      case PROVISIONING_STEPS.verifyRuntime:
        await verifyRuntime(job.id, payload)
        return
      case PROVISIONING_STEPS.markServerReady:
        await markServerReady(job.id, payload)
        return
      default:
        throw new Error(`Unsupported provisioning step: ${payload.step}`)
    }
  } catch (error) {
    console.error(
      `[worker] job ${job.id} tenant ${payload.tenantId} step ${payload.step} failed: ${getErrorMessage(error)}`,
    )
    await markTenantProvisioningFailed(payload.tenantId)
    await appendJobEvent(job.id, "failed", "Provisioning failed", {
      error: getErrorMessage(error),
      step: payload.step,
    })
    await markJobFailed(job.id, getErrorMessage(error))
    throw error
  }
}

function parseProvisionPayload(
  payload: Record<string, unknown>,
): ProvisionTenantServerPayload {
  const tenantId = payload.tenantId
  const step = payload.step
  const providerServerId = payload.providerServerId
  const actionId = payload.actionId
  const ipv4 = payload.ipv4
  const sshHost = payload.sshHost
  const sshPort = payload.sshPort
  const sshUsername = payload.sshUsername

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Provisioning job payload is missing tenantId")
  }

  return {
    tenantId,
    step:
      typeof step === "string" && isProvisioningStep(step)
        ? step
        : PROVISIONING_STEPS.createServer,
    providerServerId:
      typeof providerServerId === "string" ? providerServerId : undefined,
    actionId: typeof actionId === "string" ? actionId : undefined,
    ipv4: typeof ipv4 === "string" ? ipv4 : undefined,
    sshHost: typeof sshHost === "string" ? sshHost : undefined,
    sshPort:
      typeof sshPort === "number"
        ? sshPort
        : typeof sshPort === "string"
          ? Number.parseInt(sshPort, 10)
          : undefined,
    sshUsername: typeof sshUsername === "string" ? sshUsername : undefined,
  }
}

function isProvisioningStep(value: string): value is ProvisioningStep {
  return Object.values(PROVISIONING_STEPS).includes(
    value as (typeof PROVISIONING_STEPS)[keyof typeof PROVISIONING_STEPS],
  )
}

async function createServer(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  const provider = getProvisioningProvider()
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.createServer,
    `creating ${provider.id} server`,
  )
  const createdServer = await createProviderServer(payload.tenantId, provider)

  await updateTenantServer(payload.tenantId, {
    ipv4: createdServer.ipv4 ?? null,
    provider: provider.id,
    providerServerId: createdServer.id,
    sshHost: createdServer.host ?? createdServer.ipv4 ?? null,
    sshPort: createdServer.sshPort ?? getEnv().RUNTIME_SSH_PORT,
    sshUsername: createdServer.sshUsername ?? getEnv().RUNTIME_SSH_USERNAME,
    status: "creating_server",
  })

  await appendJobEvent(
    jobId,
    "creating_server",
    `Created ${provider.id} server`,
    {
      provider: provider.id,
      providerServerId: createdServer.id,
    },
  )

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForHetznerAction,
    createdServer.id,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      actionId: createdServer.actionId,
      ipv4: createdServer.ipv4,
      providerServerId: createdServer.id,
      sshHost: createdServer.host ?? createdServer.ipv4,
      sshPort: createdServer.sshPort ?? getEnv().RUNTIME_SSH_PORT,
      sshUsername: createdServer.sshUsername ?? getEnv().RUNTIME_SSH_USERNAME,
      step: PROVISIONING_STEPS.waitForHetznerAction,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function waitForServerAction(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId || !payload.actionId) {
    throw new Error(
      "Provisioning job cannot wait for action without server ids",
    )
  }

  const provider = getProvisioningProvider()
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForHetznerAction,
    `waiting for action ${payload.actionId}`,
  )
  await provider.waitForHostAction({
    actionId: payload.actionId,
    providerServerId: payload.providerServerId,
  })

  await updateTenantServer(payload.tenantId, {
    status: "waiting_for_server_action",
  })

  await appendJobEvent(
    jobId,
    "waiting_for_server_action",
    `${provider.id} server action completed`,
    {
      actionId: payload.actionId,
      provider: provider.id,
      providerServerId: payload.providerServerId,
    },
  )

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.fetchServerIp,
    payload.providerServerId,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.fetchServerIp,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function fetchServerIp(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot fetch server IP without a server id",
    )
  }

  const provider = getProvisioningProvider()
  const defaultSshPort = getEnv().RUNTIME_SSH_PORT
  const defaultSshUsername = getEnv().RUNTIME_SSH_USERNAME
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.fetchServerIp,
    `fetching IP for ${payload.providerServerId}`,
  )
  const server = await provider.getHost(payload.providerServerId)
  const sshHost = server.host ?? server.ipv4
  const sshPort = server.sshPort ?? defaultSshPort
  const sshUsername = server.sshUsername ?? defaultSshUsername

  if (!sshHost) {
    throw new Error(
      `Provisioning provider ${provider.id} did not return a runtime SSH host for server ${payload.providerServerId}`,
    )
  }

  await updateTenantServer(payload.tenantId, {
    ipv4: server.ipv4 ?? null,
    sshHost,
    sshPort,
    sshUsername,
    status: "fetching_server_ip",
  })

  await appendJobEvent(
    jobId,
    "fetching_server_ip",
    `Fetched ${provider.id} runtime endpoint`,
    {
      ipv4: server.ipv4 ?? null,
      provider: provider.id,
      providerServerId: payload.providerServerId,
      sshHost,
      sshPort,
      sshUsername,
    },
  )

  console.info(
    `[worker] job ${jobId} tenant ${payload.tenantId} got ${provider.id} SSH endpoint ${sshHost}:${sshPort}`,
  )
  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForSsh,
    payload.providerServerId,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      ipv4: server.ipv4,
      sshHost,
      sshPort,
      sshUsername,
      step: PROVISIONING_STEPS.waitForSsh,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function waitForSsh(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot wait for SSH without provider server metadata",
    )
  }

  const provider = getProvisioningProvider()
  const connection = resolveRuntimeSshConnection(payload)
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForSsh,
    `waiting for SSH on ${connection.host}:${connection.port ?? getEnv().RUNTIME_SSH_PORT}`,
  )
  await updateTenantServer(payload.tenantId, {
    status: "waiting_for_ssh",
  })

  if (provider.id !== "fake") {
    await appendJobEvent(
      jobId,
      "waiting_for_ssh",
      `Waiting for SSH banner on ${provider.id} server`,
      {
        providerServerId: payload.providerServerId,
        sshHost: connection.host,
        sshPort: connection.port,
      },
    )

    await sshClient.waitUntilReachable(connection)
  }

  await appendJobEvent(
    jobId,
    "waiting_for_ssh",
    `${provider.id} server is reachable over SSH`,
    {
      sshHost: connection.host,
      sshPort: connection.port,
    },
  )

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForHostBootstrap,
    payload.providerServerId,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.waitForHostBootstrap,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function waitForHostBootstrap(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot wait for host bootstrap without server metadata",
    )
  }

  const provider = getProvisioningProvider()
  const connection = resolveRuntimeSshConnection(payload)
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.waitForHostBootstrap,
    `waiting for host bootstrap checks on ${connection.host}:${connection.port ?? getEnv().RUNTIME_SSH_PORT}`,
  )
  await updateTenantServer(payload.tenantId, {
    status: "waiting_for_host_bootstrap",
  })

  if (provider.id !== "fake") {
    await appendJobEvent(
      jobId,
      "waiting_for_host_bootstrap",
      `Waiting for ${provider.id} host bootstrap checks`,
      {
        providerServerId: payload.providerServerId,
        sshHost: connection.host,
        sshPort: connection.port,
      },
    )

    await runtimeManager.waitForHostBootstrap(connection, provider.id)
  }

  await appendJobEvent(
    jobId,
    "waiting_for_host_bootstrap",
    "Tenant host bootstrap completed",
    {
      providerServerId: payload.providerServerId,
      sshHost: connection.host,
      sshPort: connection.port,
    },
  )

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.bootstrapRuntime,
    payload.providerServerId,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.bootstrapRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function bootstrapRuntime(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot bootstrap runtime without server metadata",
    )
  }

  const provider = getProvisioningProvider()
  const connection = resolveRuntimeSshConnection(payload)
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.bootstrapRuntime,
    `bootstrapping runtime on ${connection.host}:${connection.port ?? getEnv().RUNTIME_SSH_PORT}`,
  )
  await updateTenantServer(payload.tenantId, {
    status: "bootstrapping_runtime",
  })

  if (provider.id !== "fake") {
    await appendJobEvent(
      jobId,
      "bootstrapping_runtime",
      "Applying initial runtime files over SSH",
      {
        providerServerId: payload.providerServerId,
        sshHost: connection.host,
        sshPort: connection.port,
      },
    )

    if (provider.id === "hetzner") {
      const openAiCredential = await ensureTenantOpenAiCredential(
        payload.tenantId,
      )

      if (openAiCredential.created) {
        await appendJobEvent(
          jobId,
          "bootstrapping_runtime",
          "Provisioned the initial tenant-specific OpenAI API key before runtime bootstrap",
          {
            apiKeyId: openAiCredential.apiKeyId,
            projectId: openAiCredential.projectId,
            serviceAccountId: openAiCredential.serviceAccountId,
            tenantId: payload.tenantId,
          },
        )
      }
    }

    const reconciledDesiredState = await reconcileDesiredStateForProvisioning({
      ensureCurrentTenantDesiredStateVersion,
      getLatestTenantDesiredState,
      tenantId: payload.tenantId,
    })
    const desiredState = reconciledDesiredState.desiredState

    if (reconciledDesiredState.changed) {
      await appendJobEvent(
        jobId,
        "bootstrapping_runtime",
        "Reconciled desired state before initial runtime bootstrap",
        {
          desiredStateVersion: desiredState.version,
          previousDesiredStateVersion:
            reconciledDesiredState.previousDesiredStateVersion,
        },
      )
    }

    const gatewayToken = await ensureTenantRuntimeGatewayToken(payload.tenantId)
    const tenantToken = await ensureTenantRuntimeTenantToken(payload.tenantId)
    const slackBotToken = await getTenantSlackBotToken(payload.tenantId)
    const managedConfigVersion = getManagedConfigVersionFromConfigJson(
      desiredState.configJson,
    )
    const managedConfig = managedConfigVersion
      ? await getTenantManagedConfigByVersion({
          tenantId: payload.tenantId,
          version: managedConfigVersion,
        })
      : await getLatestTenantManagedConfig(payload.tenantId)
    const managedSkillVersionMap =
      getManagedSkillVersionMapFromConfigJson(desiredState.configJson) ??
      (await listLatestTenantManagedSkillVersionMapForTenant({
        tenantId: payload.tenantId,
      }))
    const managedSkillFiles = await listProjectedManagedSkillFilesForTenant({
      tenantId: payload.tenantId,
      versionMap: managedSkillVersionMap,
    })

    await runtimeManager.bootstrapTenantRuntime(connection, {
      desiredStateVersion: desiredState.version,
      gatewayToken,
      tenantToken,
      managedBootstrapFiles: managedConfig.files.map((file) => ({
        contents: file.renderedContent,
        filename: file.path,
      })),
      managedSkillFiles: managedSkillFiles.map((file) => ({
        contents: file.contents,
        filename: file.relativePath,
        projectionMode: file.projectionMode,
      })),
      openClawConfig: buildOpenClawTenantConfig({
        configJson: desiredState.configJson,
        slackBotToken,
        tenantId: payload.tenantId,
      }),
      slackBotToken,
      tenantId: payload.tenantId,
    })
  }

  await appendJobEvent(
    jobId,
    "bootstrapping_runtime",
    `${provider.id} runtime bootstrap completed`,
    {
      providerServerId: payload.providerServerId,
      sshHost: connection.host,
      sshPort: connection.port,
    },
  )

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.startRuntime,
    payload.providerServerId,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.startRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function ensureTenantOpenAiCredential(tenantId: string): Promise<{
  apiKeyId: string | null
  created: boolean
  projectId: string | null
  serviceAccountId: string | null
}> {
  const existingKey = await getTenantOpenAiApiKey(tenantId)

  if (existingKey) {
    return {
      apiKeyId: null,
      created: false,
      projectId: null,
      serviceAccountId: null,
    }
  }

  const [tenant] = await getDb()
    .select({
      id: tenants.id,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw new Error(`Provisioning could not find tenant ${tenantId}`)
  }

  const existingAccount = await getProviderAccountByTenantAndKey(
    tenant.id,
    "openai",
  )
  const provisionedCredential = await openAiProvisioner.createTenantCredential({
    existingProjectId: existingAccount?.externalProjectId ?? null,
    tenantId: tenant.id,
    tenantName: tenant.name,
    verify: true,
  })

  await persistProvisionedProviderCredential({
    credentialType: PROVIDER_CREDENTIAL_TYPES.apiKey,
    displayName: provisionedCredential.displayName,
    externalApiKeyId: provisionedCredential.apiKeyId,
    externalProjectId: provisionedCredential.projectId,
    externalServiceAccountId: provisionedCredential.serviceAccountId,
    plaintext: provisionedCredential.apiKey,
    provisionedAt: new Date(),
    providerKey: provisionedCredential.providerKey,
    revokedAt: null,
    status: "active",
    tenantId: tenant.id,
  })

  return {
    apiKeyId: provisionedCredential.apiKeyId,
    created: true,
    projectId: provisionedCredential.projectId,
    serviceAccountId: provisionedCredential.serviceAccountId,
  }
}

async function startRuntime(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot start runtime without server metadata",
    )
  }

  const provider = getProvisioningProvider()
  const connection = resolveRuntimeSshConnection(payload)
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.startRuntime,
    `starting OpenClaw runtime on ${connection.host}:${connection.port ?? getEnv().RUNTIME_SSH_PORT}`,
  )
  await updateTenantServer(payload.tenantId, {
    status: "starting_runtime",
  })

  if (provider.id !== "fake") {
    await appendJobEvent(
      jobId,
      "starting_runtime",
      "Starting OpenClaw container on tenant server",
      {
        providerServerId: payload.providerServerId,
        runtimeImage: getEnv().RUNTIME_OPENCLAW_IMAGE,
        sshHost: connection.host,
        sshPort: connection.port,
      },
    )

    await runtimeManager.restartGateway(connection)
  }

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.verifyRuntime,
    payload.providerServerId,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.verifyRuntime,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function verifyRuntime(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  if (!payload.providerServerId) {
    throw new Error(
      "Provisioning job cannot verify runtime without server metadata",
    )
  }

  const provider = getProvisioningProvider()
  const connection = resolveRuntimeSshConnection(payload)
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.verifyRuntime,
    `verifying OpenClaw runtime on ${connection.host}:${connection.port ?? getEnv().RUNTIME_SSH_PORT}`,
  )
  await updateTenantServer(payload.tenantId, {
    status: "verifying_runtime",
  })

  if (provider.id !== "fake") {
    await appendJobEvent(
      jobId,
      "verifying_runtime",
      "Checking OpenClaw gateway health",
      {
        providerServerId: payload.providerServerId,
        sshHost: connection.host,
        sshPort: connection.port,
      },
    )

    await runtimeManager.checkGatewayHealth(connection)
  }

  await appendJobEvent(
    jobId,
    "verifying_runtime",
    "OpenClaw runtime health check passed",
    {
      providerServerId: payload.providerServerId,
      sshHost: connection.host,
      sshPort: connection.port,
    },
  )

  logRequeue(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.markServerReady,
    payload.providerServerId,
  )
  await requeueJob(
    jobId,
    {
      ...payload,
      step: PROVISIONING_STEPS.markServerReady,
    },
    new Date(Date.now() + getProvisioningDelayMs(provider)),
  )
}

async function markServerReady(
  jobId: string,
  payload: ProvisionTenantServerPayload,
) {
  const runtimeConnection = resolveRuntimeSshConnection(payload)

  if (!payload.providerServerId) {
    throw new Error("Provisioning job cannot complete without server metadata")
  }

  const provider = getProvisioningProvider()
  logStep(
    jobId,
    payload.tenantId,
    PROVISIONING_STEPS.markServerReady,
    `marking ready with SSH endpoint ${runtimeConnection.host}:${runtimeConnection.port ?? getEnv().RUNTIME_SSH_PORT}`,
  )
  const db = getDb()

  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .select({
        organizationId: tenants.organizationId,
      })
      .from(tenants)
      .where(eq(tenants.id, payload.tenantId))
      .limit(1)

    if (!tenant) {
      throw new Error("Tenant not found while marking server ready")
    }

    await tx
      .update(tenantServers)
      .set({
        ipv4: payload.ipv4 ?? null,
        provider: provider.id,
        providerServerId: payload.providerServerId,
        sshHost: runtimeConnection.host,
        sshPort: runtimeConnection.port ?? getEnv().RUNTIME_SSH_PORT,
        sshUsername:
          runtimeConnection.username ?? getEnv().RUNTIME_SSH_USERNAME,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tenantServers.tenantId, payload.tenantId))

    await tx
      .update(tenants)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, payload.tenantId))

    await tx
      .update(organizations)
      .set({
        isReady: true,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, tenant.organizationId))
  })

  await appendJobEvent(jobId, "ready", "Tenant server marked ready", {
    ipv4: payload.ipv4 ?? null,
    providerServerId: payload.providerServerId,
    sshHost: runtimeConnection.host,
    sshPort: runtimeConnection.port,
  })

  const scheduledTasksRefreshJobId = await enqueueJob({
    jobType: JOB_TYPES.reconcileTenantScheduledTasks,
    payload: {
      tenantId: payload.tenantId,
    },
  })

  await appendJobEvent(
    jobId,
    "scheduled_tasks_refresh_queued",
    "Queued initial scheduled task refresh",
    {
      scheduledTasksRefreshJobId,
      tenantId: payload.tenantId,
    },
  )

  await markJobSucceeded(jobId, {
    ipv4: payload.ipv4 ?? null,
    provider: provider.id,
    providerServerId: payload.providerServerId,
    scheduledTasksRefreshJobId,
    sshHost: runtimeConnection.host,
    sshPort: runtimeConnection.port,
  })

  console.info(
    `[worker] job ${jobId} tenant ${payload.tenantId} ready on ${provider.id} server ${payload.providerServerId} (${runtimeConnection.host}:${runtimeConnection.port ?? getEnv().RUNTIME_SSH_PORT})`,
  )
}

async function updateTenantServer(
  tenantId: string,
  input: {
    ipv4?: string | null
    provider?: string
    providerServerId?: string
    sshHost?: string | null
    sshPort?: number | null
    sshUsername?: string
    status: string
  },
) {
  const db = getDb()

  await db
    .update(tenantServers)
    .set({
      ...(input.ipv4 !== undefined ? { ipv4: input.ipv4 } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.providerServerId
        ? { providerServerId: input.providerServerId }
        : {}),
      ...(input.sshHost !== undefined ? { sshHost: input.sshHost } : {}),
      ...(input.sshPort !== undefined ? { sshPort: input.sshPort } : {}),
      ...(input.sshUsername ? { sshUsername: input.sshUsername } : {}),
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(tenantServers.tenantId, tenantId))
}

async function markTenantProvisioningFailed(tenantId: string) {
  const db = getDb()

  await db.transaction(async (tx) => {
    await tx
      .update(tenantServers)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(tenantServers.tenantId, tenantId))

    await tx
      .update(tenants)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Unknown provisioning error"
}

async function reconcileDesiredStateForProvisioning(input: {
  ensureCurrentTenantDesiredStateVersion: typeof ensureCurrentTenantDesiredStateVersion
  getLatestTenantDesiredState: typeof getLatestTenantDesiredState
  tenantId: string
}) {
  const [latestDesiredState, currentDesiredState] = await Promise.all([
    input.getLatestTenantDesiredState(input.tenantId),
    input.ensureCurrentTenantDesiredStateVersion({
      tenantId: input.tenantId,
    }),
  ])

  return {
    changed:
      currentDesiredState.changed ||
      currentDesiredState.version !== latestDesiredState.version,
    desiredState: currentDesiredState,
    previousDesiredStateVersion: latestDesiredState.version,
  }
}

export const __testing = {
  resolveRuntimeSshConnection,
  reconcileDesiredStateForProvisioning,
}

function logStep(
  jobId: string,
  tenantId: string,
  step: ProvisioningStep | undefined,
  message: string,
) {
  console.info(
    `[worker] job ${jobId} tenant ${tenantId} step ${step ?? "unknown"}: ${message}`,
  )
}

function logRequeue(
  jobId: string,
  tenantId: string,
  nextStep: ProvisioningStep,
  providerServerId?: string,
) {
  const provider = getProvisioningProvider()
  const availableAt = new Date(
    Date.now() + getProvisioningDelayMs(provider),
  ).toISOString()
  const serverText = providerServerId ? ` server ${providerServerId}` : ""

  console.info(
    `[worker] job ${jobId} tenant ${tenantId}${serverText} requeued for ${nextStep} at ${availableAt}`,
  )
}

async function createProviderServer(
  tenantId: string,
  provider: ProvisioningProvider,
) {
  if (provider.id === "hetzner") {
    const env = getEnv()
    const sshKeys = env.HETZNER_SSH_KEY_NAMES.split(",")
      .map((value) => value.trim())
      .filter(Boolean)

    console.info(
      `[worker] tenant ${tenantId} hetzner config: server_type=${env.HETZNER_DEFAULT_SERVER_TYPE} image=${env.HETZNER_DEFAULT_IMAGE} location=${env.HETZNER_DEFAULT_LOCATION} ssh_keys=${sshKeys.join(",") || "none"}`,
    )

    return provider.createHost({
      hetzner: {
        image: env.HETZNER_DEFAULT_IMAGE,
        labels: {
          "otto/managed": "true",
          "otto/runtime": "openclaw",
          "otto/tenant_id": tenantId,
        },
        location: env.HETZNER_DEFAULT_LOCATION,
        name: buildHetznerServerName(tenantId),
        serverType: env.HETZNER_DEFAULT_SERVER_TYPE,
        sshKeys,
        userData: renderCloudInit(),
      },
      tenantId,
    })
  }

  return provider.createHost({ tenantId })
}

function buildHetznerServerName(tenantId: string) {
  return `otto-${tenantId.slice(0, 12)}`
}

function getProvisioningDelayMs(provider: ProvisioningProvider) {
  return provider.id === "hetzner" ? 0 : STEP_DELAY_MS
}

function getProvisioningProvider() {
  return resolveProvisioningProvider()
}

function resolveRuntimeSshConnection(payload: ProvisionTenantServerPayload) {
  const env = getEnv()
  const host = payload.sshHost ?? payload.ipv4

  if (!host) {
    throw new Error(
      "Provisioning job cannot resolve tenant runtime SSH host from payload",
    )
  }

  return {
    host,
    port: payload.sshPort ?? env.RUNTIME_SSH_PORT,
    username: payload.sshUsername ?? env.RUNTIME_SSH_USERNAME,
  } as const
}
