import {
  getLatestTenantScheduledTasksRefreshJob,
  getTenantScheduledTask,
  listTenantScheduledTaskSessions,
  listTenantScheduledTasks,
} from "@otto/feature-runtime-core/scheduled-tasks/queries"
import type {
  WorkspaceScheduledTaskDetailResponse,
  WorkspaceScheduledTaskRunsResponse,
  WorkspaceScheduledTasksListResponse,
  WorkspaceScheduledTasksRefreshResponse,
} from "@otto/feature-runtime-core/scheduled-tasks/workspace-contracts"

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"
import {
  getOrganizationTenantForBilling,
  getOrganizationWorkspaceBySlug,
  getWorkspaceSummaryBySlugForUser,
} from "../workspace/data"

type LatestScheduledTasksRefreshJob = Awaited<
  ReturnType<typeof getLatestTenantScheduledTasksRefreshJob>
>

export function getLatestScheduledTasksSyncedAt(
  tasks: Array<{ lastSyncedAt: Date | null }>,
  latestRefreshJob: LatestScheduledTasksRefreshJob,
): Date | null {
  const latestTaskSyncedAt = tasks.reduce<Date | null>((latest, task) => {
    if (!task.lastSyncedAt) {
      return latest
    }

    if (!latest) {
      return task.lastSyncedAt
    }

    return latest > task.lastSyncedAt ? latest : task.lastSyncedAt
  }, null)

  if (latestTaskSyncedAt) {
    return latestTaskSyncedAt
  }

  if (
    latestRefreshJob?.status === "succeeded" &&
    latestRefreshJob.finishedAt
  ) {
    return latestRefreshJob.finishedAt
  }

  return null
}

type ScheduledTasksRefreshJob = NonNullable<
  WorkspaceScheduledTasksListResponse["latestRefreshJob"]
>

function normalizeRefreshJobStatus(
  status: string,
): ScheduledTasksRefreshJob["status"] {
  switch (status) {
    case "queued":
    case "running":
    case "succeeded":
    case "failed":
      return status
    default:
      return "failed"
  }
}

function mapRefreshJob(
  job: Awaited<ReturnType<typeof getLatestTenantScheduledTasksRefreshJob>>,
) {
  if (!job) {
    return null
  }

  return {
    createdAt: job.createdAt.toISOString(),
    error: job.error,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    id: job.id,
    startedAt: job.startedAt?.toISOString() ?? null,
    status: normalizeRefreshJobStatus(job.status),
  } as const
}

function mapTask(task: Awaited<ReturnType<typeof listTenantScheduledTasks>>[number]) {
  return {
    agentId: task.agentId,
    deleteAfterRun: task.deleteAfterRun,
    deliveryJson: task.deliveryJson,
    description: task.description,
    enabled: task.enabled,
    failureAlertJson: task.failureAlertJson,
    id: task.id,
    lastError: task.lastError,
    lastRunAt: task.lastRunAt?.toISOString() ?? null,
    lastRunStatus: task.lastRunStatus,
    lastSyncError: task.lastSyncError,
    lastSyncedAt: task.lastSyncedAt?.toISOString() ?? null,
    name: task.name,
    nextRunAt: task.nextRunAt?.toISOString() ?? null,
    payloadJson: task.payloadJson,
    scheduleExpression: task.scheduleExpression,
    scheduleJson: task.scheduleJson,
    scheduleKind: task.scheduleKind,
    sessionKey: task.sessionKey,
    sessionTarget: task.sessionTarget,
    status: task.status,
    taskKey: task.taskKey,
    timezone: task.timezone,
    updatedAt: task.updatedAt?.toISOString() ?? null,
    wakeMode: task.wakeMode,
  } as const
}

function mapRun(
  run: Awaited<ReturnType<typeof listTenantScheduledTaskSessions>>[number],
) {
  return {
    error: run.error,
    externalSessionId: run.externalSessionId,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    hasSyncedSession: run.hasSyncedSession,
    id: run.id,
    runtimeSessionKey: run.runtimeSessionKey,
    scheduledFor: run.scheduledFor?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    status: run.status,
    summary: run.summary,
    taskKey: run.taskKey,
    taskName: run.taskName,
    triggerType: run.triggerType,
  } as const
}

async function getAuthorizedScheduledTasksContext(input: {
  orgSlug: string
  userExternalId: string
}) {
  const workspace = await getWorkspaceSummaryBySlugForUser(input)

  if (!workspace) {
    throw new Error("Organization not found")
  }

  const tenant = await getOrganizationTenantForBilling(workspace.id)

  return {
    dateTimePreferences: {
      locale: workspace.locale,
      timeFormatPreference: workspace.timeFormatPreference,
      timeZone: workspace.timezone,
    },
    organizationId: workspace.id,
    tenantId: tenant?.id ?? null,
  }
}

export async function listWorkspaceScheduledTasks(input: {
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceScheduledTasksListResponse> {
  const { dateTimePreferences, tenantId } =
    await getAuthorizedScheduledTasksContext(input)

  if (!tenantId) {
    return {
      dateTimePreferences,
      latestRefreshJob: null,
      latestSyncedAt: null,
      state: "pending_setup",
      tasks: [],
    }
  }

  const [tasks, latestRefreshJob] = await Promise.all([
    listTenantScheduledTasks({
      tenantId,
    }),
    getLatestTenantScheduledTasksRefreshJob({
      tenantId,
    }),
  ])

  return {
    dateTimePreferences,
    latestRefreshJob: mapRefreshJob(latestRefreshJob),
    latestSyncedAt:
      getLatestScheduledTasksSyncedAt(tasks, latestRefreshJob)?.toISOString() ??
      null,
    state: "ready",
    tasks: tasks.map(mapTask),
  }
}

export async function listWorkspaceScheduledTaskRuns(input: {
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceScheduledTaskRunsResponse> {
  const { dateTimePreferences, tenantId } =
    await getAuthorizedScheduledTasksContext(input)

  if (!tenantId) {
    return {
      dateTimePreferences,
      latestRefreshJob: null,
      latestSyncedAt: null,
      runs: [],
      state: "pending_setup",
    }
  }

  const [tasks, runs, latestRefreshJob] = await Promise.all([
    listTenantScheduledTasks({
      tenantId,
    }),
    listTenantScheduledTaskSessions({
      tenantId,
    }),
    getLatestTenantScheduledTasksRefreshJob({
      tenantId,
    }),
  ])

  return {
    dateTimePreferences,
    latestRefreshJob: mapRefreshJob(latestRefreshJob),
    latestSyncedAt:
      getLatestScheduledTasksSyncedAt(tasks, latestRefreshJob)?.toISOString() ??
      null,
    runs: runs.map(mapRun),
    state: "ready",
  }
}

export async function getWorkspaceScheduledTaskDetail(input: {
  orgSlug: string
  taskKey: string
  userExternalId: string
}): Promise<WorkspaceScheduledTaskDetailResponse | null> {
  const decodedTaskKey = decodeURIComponent(input.taskKey)
  const { dateTimePreferences, tenantId } =
    await getAuthorizedScheduledTasksContext(input)

  if (!tenantId) {
    return {
      dateTimePreferences,
      latestRefreshJob: null,
      latestSyncedAt: null,
      runs: [],
      state: "pending_setup",
      task: null,
    }
  }

  const [task, runs, latestRefreshJob] = await Promise.all([
    getTenantScheduledTask({
      taskKey: decodedTaskKey,
      tenantId,
    }),
    listTenantScheduledTaskSessions({
      taskKey: decodedTaskKey,
      tenantId,
    }),
    getLatestTenantScheduledTasksRefreshJob({
      tenantId,
    }),
  ])

  if (!task) {
    return null
  }

  return {
    dateTimePreferences,
    latestRefreshJob: mapRefreshJob(latestRefreshJob),
    latestSyncedAt: task.lastSyncedAt?.toISOString() ?? null,
    runs: runs.map(mapRun),
    state: "ready",
    task: mapTask(task),
  }
}

export async function refreshWorkspaceScheduledTasks(input: {
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceScheduledTasksRefreshResponse> {
  const workspace = await getOrganizationWorkspaceBySlug(input)
  const tenant = await getOrganizationTenantForBilling(workspace.id)

  if (!tenant) {
    throw new Error("No tenant found for organization")
  }

  const jobId = await enqueueJob({
    jobType: JOB_TYPES.reconcileTenantScheduledTasks,
    payload: {
      tenantId: tenant.id,
    },
  })

  return {
    jobId,
    ok: true,
  }
}
