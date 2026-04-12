import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  jobRuns,
  tenantScheduledTaskSessions,
  tenantScheduledTasks,
  tenantSessions,
} from "@otto/feature-integrations-runtime/db/schema"
import { and, desc, eq, inArray, not } from "drizzle-orm"

import type {
  ScheduledTaskSessionSnapshotRow,
  ScheduledTaskSnapshotRow,
} from "./sync"

const RECONCILE_TENANT_SCHEDULED_TASKS_JOB_TYPE =
  "reconcile_tenant_scheduled_tasks"

export const SCHEDULED_TASKS_STALE_AFTER_MS = 15 * 60 * 1000

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function getTaskRunSortMs(run: ScheduledTaskSessionSnapshotRow) {
  return (
    run.finishedAt?.getTime() ??
    run.startedAt?.getTime() ??
    run.scheduledFor?.getTime() ??
    0
  )
}

function normalizeScheduledTaskRow<
  TRow extends {
    deliveryJson: unknown
    failureAlertJson: unknown
    payloadJson: unknown
    scheduleJson: unknown
  },
>(row: TRow) {
  return {
    ...row,
    deliveryJson: asRecord(row.deliveryJson),
    failureAlertJson: asRecord(row.failureAlertJson),
    payloadJson: asRecord(row.payloadJson),
    scheduleJson: asRecord(row.scheduleJson),
  }
}

function buildDeletedPlaceholderTasks(runs: ScheduledTaskSessionSnapshotRow[]) {
  const placeholderTasks = new Map<string, ScheduledTaskSnapshotRow>()

  for (const run of runs) {
    if (placeholderTasks.has(run.taskKey)) {
      continue
    }

    placeholderTasks.set(run.taskKey, {
      agentId: null,
      deleteAfterRun: true,
      deliveryJson: null,
      description:
        "Runtime task definition was deleted before Otto synced its full configuration.",
      enabled: false,
      failureAlertJson: null,
      lastError: run.error,
      lastRunAt: run.finishedAt ?? run.startedAt ?? run.scheduledFor,
      lastRunStatus: run.status,
      name: run.taskName,
      nextRunAt: null,
      payloadJson: null,
      runtimeUpdatedAt: null,
      scheduleExpression: "Deleted before sync",
      scheduleJson: null,
      scheduleKind: "unknown",
      sessionKey: null,
      sessionTarget: null,
      status: "deleted",
      taskKey: run.taskKey,
      timezone: null,
      wakeMode: null,
    })
  }

  return [...placeholderTasks.values()]
}

export async function replaceTenantScheduledTasksSnapshot(input: {
  tasks: ScheduledTaskSnapshotRow[]
  tenantId: string
}) {
  const db = getDb()
  const now = new Date()
  const currentTaskKeys = input.tasks.map((task) => task.taskKey)

  if (currentTaskKeys.length === 0) {
    await db
      .update(tenantScheduledTasks)
      .set({
        enabled: false,
        lastSyncError: null,
        lastSyncedAt: now,
        nextRunAt: null,
        status: "deleted",
        updatedAt: now,
      })
      .where(eq(tenantScheduledTasks.tenantId, input.tenantId))
  } else {
    await db
      .update(tenantScheduledTasks)
      .set({
        enabled: false,
        lastSyncError: null,
        lastSyncedAt: now,
        nextRunAt: null,
        status: "deleted",
        updatedAt: now,
      })
      .where(
        and(
          eq(tenantScheduledTasks.tenantId, input.tenantId),
          not(inArray(tenantScheduledTasks.taskKey, currentTaskKeys)),
        ),
      )
  }

  for (const task of input.tasks) {
    await db
      .insert(tenantScheduledTasks)
      .values({
        agentId: task.agentId,
        deleteAfterRun: task.deleteAfterRun,
        deliveryJson: task.deliveryJson,
        description: task.description,
        enabled: task.enabled,
        failureAlertJson: task.failureAlertJson,
        lastError: task.lastError,
        lastRunAt: task.lastRunAt,
        lastRunStatus: task.lastRunStatus,
        lastSyncError: null,
        lastSyncedAt: now,
        name: task.name,
        nextRunAt: task.nextRunAt,
        payloadJson: task.payloadJson,
        runtimeUpdatedAt: task.runtimeUpdatedAt,
        scheduleExpression: task.scheduleExpression,
        scheduleJson: task.scheduleJson,
        scheduleKind: task.scheduleKind,
        sessionKey: task.sessionKey,
        sessionTarget: task.sessionTarget,
        status: task.status,
        taskKey: task.taskKey,
        tenantId: input.tenantId,
        timezone: task.timezone,
        updatedAt: now,
        wakeMode: task.wakeMode,
      })
      .onConflictDoUpdate({
        set: {
          agentId: task.agentId,
          deleteAfterRun: task.deleteAfterRun,
          deliveryJson: task.deliveryJson,
          description: task.description,
          enabled: task.enabled,
          failureAlertJson: task.failureAlertJson,
          lastError: task.lastError,
          lastRunAt: task.lastRunAt,
          lastRunStatus: task.lastRunStatus,
          lastSyncError: null,
          lastSyncedAt: now,
          name: task.name,
          nextRunAt: task.nextRunAt,
          payloadJson: task.payloadJson,
          runtimeUpdatedAt: task.runtimeUpdatedAt,
          scheduleExpression: task.scheduleExpression,
          scheduleJson: task.scheduleJson,
          scheduleKind: task.scheduleKind,
          sessionKey: task.sessionKey,
          sessionTarget: task.sessionTarget,
          status: task.status,
          timezone: task.timezone,
          updatedAt: now,
          wakeMode: task.wakeMode,
        },
        target: [tenantScheduledTasks.tenantId, tenantScheduledTasks.taskKey],
      })
  }
}

export async function upsertTenantScheduledTaskRuns(input: {
  runs: ScheduledTaskSessionSnapshotRow[]
  tenantId: string
}) {
  if (input.runs.length === 0) {
    return
  }

  const db = getDb()
  const now = new Date()

  for (const task of buildDeletedPlaceholderTasks(input.runs)) {
    await db
      .insert(tenantScheduledTasks)
      .values({
        agentId: null,
        deleteAfterRun: task.deleteAfterRun,
        deliveryJson: task.deliveryJson,
        description: task.description,
        enabled: task.enabled,
        failureAlertJson: task.failureAlertJson,
        lastError: task.lastError,
        lastRunAt: task.lastRunAt,
        lastRunStatus: task.lastRunStatus,
        lastSyncError: null,
        lastSyncedAt: now,
        name: task.name,
        nextRunAt: task.nextRunAt,
        payloadJson: task.payloadJson,
        runtimeUpdatedAt: task.runtimeUpdatedAt,
        scheduleExpression: task.scheduleExpression,
        scheduleJson: task.scheduleJson,
        scheduleKind: task.scheduleKind,
        sessionKey: task.sessionKey,
        sessionTarget: task.sessionTarget,
        status: task.status,
        taskKey: task.taskKey,
        tenantId: input.tenantId,
        timezone: task.timezone,
        updatedAt: now,
        wakeMode: task.wakeMode,
      })
      .onConflictDoNothing({
        target: [tenantScheduledTasks.tenantId, tenantScheduledTasks.taskKey],
      })
  }

  const taskRows = await db
    .select({
      id: tenantScheduledTasks.id,
      taskKey: tenantScheduledTasks.taskKey,
    })
    .from(tenantScheduledTasks)
    .where(eq(tenantScheduledTasks.tenantId, input.tenantId))

  const taskIdByKey = new Map(taskRows.map((row) => [row.taskKey, row.id]))

  for (const run of input.runs) {
    await db
      .insert(tenantScheduledTaskSessions)
      .values({
        error: run.error,
        externalRunKey: run.externalRunKey,
        externalSessionId: run.externalSessionId,
        finishedAt: run.finishedAt,
        runtimeSessionKey: run.runtimeSessionKey,
        scheduledFor: run.scheduledFor,
        startedAt: run.startedAt,
        status: run.status,
        summary: run.summary,
        taskKey: run.taskKey,
        taskName: run.taskName,
        tenantId: input.tenantId,
        tenantScheduledTaskId: taskIdByKey.get(run.taskKey) ?? null,
        triggerType: run.triggerType,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          error: run.error,
          externalSessionId: run.externalSessionId,
          finishedAt: run.finishedAt,
          runtimeSessionKey: run.runtimeSessionKey,
          scheduledFor: run.scheduledFor,
          startedAt: run.startedAt,
          status: run.status,
          summary: run.summary,
          taskKey: run.taskKey,
          taskName: run.taskName,
          tenantScheduledTaskId: taskIdByKey.get(run.taskKey) ?? null,
          triggerType: run.triggerType,
          updatedAt: now,
        },
        target: [
          tenantScheduledTaskSessions.tenantId,
          tenantScheduledTaskSessions.externalRunKey,
        ],
      })
  }

  const latestRunByTaskKey = new Map<string, ScheduledTaskSessionSnapshotRow>()

  for (const run of input.runs) {
    const nextSortMs = getTaskRunSortMs(run)
    const current = latestRunByTaskKey.get(run.taskKey)
    const currentSortMs = current ? getTaskRunSortMs(current) : null

    if (currentSortMs === null || nextSortMs > currentSortMs) {
      latestRunByTaskKey.set(run.taskKey, run)
    }
  }

  for (const [taskKey, run] of latestRunByTaskKey) {
    await db
      .update(tenantScheduledTasks)
      .set({
        lastError: run.error,
        lastRunAt: run.finishedAt ?? run.startedAt ?? run.scheduledFor,
        lastRunStatus: run.status,
        lastSyncError: null,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(tenantScheduledTasks.tenantId, input.tenantId),
          eq(tenantScheduledTasks.taskKey, taskKey),
        ),
      )
  }
}

export async function upsertTenantScheduledTasksSnapshot(input: {
  runs: ScheduledTaskSessionSnapshotRow[]
  tasks: ScheduledTaskSnapshotRow[]
  tenantId: string
}) {
  await replaceTenantScheduledTasksSnapshot({
    tasks: input.tasks,
    tenantId: input.tenantId,
  })
  await upsertTenantScheduledTaskRuns({
    runs: input.runs,
    tenantId: input.tenantId,
  })
}

export async function markTenantScheduledTasksSyncFailed(input: {
  error: string
  tenantId: string
}) {
  const db = getDb()

  await db
    .update(tenantScheduledTasks)
    .set({
      lastSyncError: input.error,
      updatedAt: new Date(),
    })
    .where(eq(tenantScheduledTasks.tenantId, input.tenantId))
}

export async function listTenantScheduledTasks(input: { tenantId: string }) {
  const db = getDb()

  return db
    .select({
      agentId: tenantScheduledTasks.agentId,
      deleteAfterRun: tenantScheduledTasks.deleteAfterRun,
      deliveryJson: tenantScheduledTasks.deliveryJson,
      description: tenantScheduledTasks.description,
      enabled: tenantScheduledTasks.enabled,
      failureAlertJson: tenantScheduledTasks.failureAlertJson,
      id: tenantScheduledTasks.id,
      lastError: tenantScheduledTasks.lastError,
      lastRunAt: tenantScheduledTasks.lastRunAt,
      lastRunStatus: tenantScheduledTasks.lastRunStatus,
      lastSyncError: tenantScheduledTasks.lastSyncError,
      lastSyncedAt: tenantScheduledTasks.lastSyncedAt,
      name: tenantScheduledTasks.name,
      nextRunAt: tenantScheduledTasks.nextRunAt,
      payloadJson: tenantScheduledTasks.payloadJson,
      scheduleExpression: tenantScheduledTasks.scheduleExpression,
      scheduleJson: tenantScheduledTasks.scheduleJson,
      scheduleKind: tenantScheduledTasks.scheduleKind,
      sessionKey: tenantScheduledTasks.sessionKey,
      sessionTarget: tenantScheduledTasks.sessionTarget,
      status: tenantScheduledTasks.status,
      taskKey: tenantScheduledTasks.taskKey,
      timezone: tenantScheduledTasks.timezone,
      updatedAt: tenantScheduledTasks.updatedAt,
      wakeMode: tenantScheduledTasks.wakeMode,
    })
    .from(tenantScheduledTasks)
    .where(eq(tenantScheduledTasks.tenantId, input.tenantId))
    .orderBy(tenantScheduledTasks.name)
    .then((rows) => rows.map(normalizeScheduledTaskRow))
}

export async function getTenantScheduledTask(input: {
  taskKey: string
  tenantId: string
}) {
  const db = getDb()

  const [task] = await db
    .select({
      agentId: tenantScheduledTasks.agentId,
      deleteAfterRun: tenantScheduledTasks.deleteAfterRun,
      deliveryJson: tenantScheduledTasks.deliveryJson,
      description: tenantScheduledTasks.description,
      enabled: tenantScheduledTasks.enabled,
      failureAlertJson: tenantScheduledTasks.failureAlertJson,
      id: tenantScheduledTasks.id,
      lastError: tenantScheduledTasks.lastError,
      lastRunAt: tenantScheduledTasks.lastRunAt,
      lastRunStatus: tenantScheduledTasks.lastRunStatus,
      lastSyncError: tenantScheduledTasks.lastSyncError,
      lastSyncedAt: tenantScheduledTasks.lastSyncedAt,
      name: tenantScheduledTasks.name,
      nextRunAt: tenantScheduledTasks.nextRunAt,
      payloadJson: tenantScheduledTasks.payloadJson,
      scheduleExpression: tenantScheduledTasks.scheduleExpression,
      scheduleJson: tenantScheduledTasks.scheduleJson,
      scheduleKind: tenantScheduledTasks.scheduleKind,
      sessionKey: tenantScheduledTasks.sessionKey,
      sessionTarget: tenantScheduledTasks.sessionTarget,
      status: tenantScheduledTasks.status,
      taskKey: tenantScheduledTasks.taskKey,
      timezone: tenantScheduledTasks.timezone,
      updatedAt: tenantScheduledTasks.updatedAt,
      wakeMode: tenantScheduledTasks.wakeMode,
    })
    .from(tenantScheduledTasks)
    .where(
      and(
        eq(tenantScheduledTasks.tenantId, input.tenantId),
        eq(tenantScheduledTasks.taskKey, input.taskKey),
      ),
    )
    .limit(1)

  return task ? normalizeScheduledTaskRow(task) : null
}

export async function listTenantScheduledTaskSessions(input: {
  limit?: number
  taskKey?: string
  tenantId: string
}) {
  const db = getDb()
  const limit = input.limit ?? 50

  return db
    .select({
      error: tenantScheduledTaskSessions.error,
      externalSessionId: tenantScheduledTaskSessions.externalSessionId,
      finishedAt: tenantScheduledTaskSessions.finishedAt,
      hasSyncedSession: tenantSessions.id,
      id: tenantScheduledTaskSessions.id,
      runtimeSessionKey: tenantScheduledTaskSessions.runtimeSessionKey,
      scheduledFor: tenantScheduledTaskSessions.scheduledFor,
      startedAt: tenantScheduledTaskSessions.startedAt,
      status: tenantScheduledTaskSessions.status,
      summary: tenantScheduledTaskSessions.summary,
      taskKey: tenantScheduledTaskSessions.taskKey,
      taskName: tenantScheduledTaskSessions.taskName,
      triggerType: tenantScheduledTaskSessions.triggerType,
    })
    .from(tenantScheduledTaskSessions)
    .leftJoin(
      tenantSessions,
      and(
        eq(tenantSessions.tenantId, tenantScheduledTaskSessions.tenantId),
        eq(
          tenantSessions.sessionKey,
          tenantScheduledTaskSessions.runtimeSessionKey,
        ),
      ),
    )
    .where(
      and(
        eq(tenantScheduledTaskSessions.tenantId, input.tenantId),
        input.taskKey
          ? eq(tenantScheduledTaskSessions.taskKey, input.taskKey)
          : undefined,
      ),
    )
    .orderBy(
      desc(tenantScheduledTaskSessions.startedAt),
      desc(tenantScheduledTaskSessions.createdAt),
    )
    .limit(limit)
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        hasSyncedSession: Boolean(row.hasSyncedSession),
      })),
    )
}

export async function getLatestTenantScheduledTasksRefreshJob(input: {
  tenantId: string
}) {
  const db = getDb()

  const [job] = await db
    .select({
      createdAt: jobRuns.createdAt,
      error: jobRuns.error,
      finishedAt: jobRuns.finishedAt,
      id: jobRuns.id,
      startedAt: jobRuns.startedAt,
      status: jobRuns.status,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.tenantId, input.tenantId),
        eq(jobRuns.jobType, RECONCILE_TENANT_SCHEDULED_TASKS_JOB_TYPE),
      ),
    )
    .orderBy(desc(jobRuns.createdAt))
    .limit(1)

  return job ?? null
}

export function getCronSessionTaskKeyMapRows(input: {
  tenantId: string
}): Promise<Array<{ runtimeSessionKey: string | null; taskKey: string }>> {
  const db = getDb()

  return db
    .select({
      runtimeSessionKey: tenantScheduledTaskSessions.runtimeSessionKey,
      taskKey: tenantScheduledTaskSessions.taskKey,
    })
    .from(tenantScheduledTaskSessions)
    .where(
      and(
        eq(tenantScheduledTaskSessions.tenantId, input.tenantId),
        not(eq(tenantScheduledTaskSessions.runtimeSessionKey, "")),
      ),
    )
}

export async function getCronSessionTaskKeyMap(input: {
  tenantId: string
}): Promise<Map<string, string>> {
  const rows = await getCronSessionTaskKeyMapRows(input)
  const map = new Map<string, string>()

  for (const row of rows) {
    if (row.runtimeSessionKey) {
      map.set(row.runtimeSessionKey, row.taskKey)
    }
  }

  return map
}

export function isScheduledTaskStale(lastSyncedAt: Date | null) {
  if (!lastSyncedAt) {
    return true
  }

  return Date.now() - lastSyncedAt.getTime() > SCHEDULED_TASKS_STALE_AFTER_MS
}
