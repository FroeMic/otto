import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  tenantScheduledTaskSessions,
  tenantScheduledTasks,
} from "@otto/feature-integrations-runtime/db/schema"
import { and, eq, inArray, not } from "drizzle-orm"

import type {
  ScheduledTaskSessionSnapshotRow,
  ScheduledTaskSnapshotRow,
} from "./scheduled-tasks-sync"

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
        lastSyncError: null,
        lastSyncedAt: now,
        status: "deleted",
        updatedAt: now,
      })
      .where(eq(tenantScheduledTasks.tenantId, input.tenantId))
  } else {
    await db
      .update(tenantScheduledTasks)
      .set({
        lastSyncError: null,
        lastSyncedAt: now,
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

function buildDeletedPlaceholderTasks(
  runs: ScheduledTaskSessionSnapshotRow[],
): ScheduledTaskSnapshotRow[] {
  const seen = new Set<string>()
  const placeholders: ScheduledTaskSnapshotRow[] = []

  for (const run of runs) {
    if (seen.has(run.taskKey)) {
      continue
    }

    seen.add(run.taskKey)
    placeholders.push({
      agentId: null,
      deleteAfterRun: true,
      deliveryJson: null,
      description: null,
      enabled: false,
      failureAlertJson: null,
      lastError: run.error,
      lastRunAt: run.finishedAt ?? run.startedAt ?? run.scheduledFor,
      lastRunStatus: run.status,
      name: run.taskName,
      nextRunAt: null,
      payloadJson: null,
      runtimeUpdatedAt: null,
      scheduleExpression: "Deleted after run",
      scheduleJson: null,
      scheduleKind: "deleted",
      sessionKey: run.runtimeSessionKey,
      sessionTarget: null,
      status: "deleted",
      taskKey: run.taskKey,
      timezone: null,
      wakeMode: null,
    })
  }

  return placeholders
}

function getTaskRunSortMs(run: ScheduledTaskSessionSnapshotRow) {
  return (
    run.finishedAt?.getTime() ??
    run.startedAt?.getTime() ??
    run.scheduledFor?.getTime() ??
    0
  )
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

export async function listTenantScheduledTasks(input: { tenantId: string }) {
  const db = getDb()
  return db
    .select({
      name: tenantScheduledTasks.name,
      taskKey: tenantScheduledTasks.taskKey,
    })
    .from(tenantScheduledTasks)
    .where(eq(tenantScheduledTasks.tenantId, input.tenantId))
}
