import { and, desc, eq, inArray, not } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  jobRuns,
  tenantScheduledTaskSessions,
  tenantScheduledTasks,
} from "@/db/schema";
import { JOB_TYPES } from "@/lib/jobs/types";

export const SCHEDULED_TASKS_STALE_AFTER_MS = 15 * 60 * 1000;

export type ScheduledTaskSnapshotRow = {
  description: string | null;
  enabled: boolean;
  lastError: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  name: string;
  nextRunAt: Date | null;
  runtimeUpdatedAt: number | null;
  scheduleExpression: string;
  scheduleKind: string;
  sessionTarget: string | null;
  status: string;
  taskKey: string;
  timezone: string | null;
};

export type ScheduledTaskSessionSnapshotRow = {
  error: string | null;
  externalRunKey: string;
  externalSessionId: string | null;
  finishedAt: Date | null;
  runtimeSessionKey: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  status: string;
  summary: string | null;
  taskKey: string;
  taskName: string;
  triggerType: string;
};

export async function upsertTenantScheduledTasksSnapshot(input: {
  runs: ScheduledTaskSessionSnapshotRow[];
  tasks: ScheduledTaskSnapshotRow[];
  tenantId: string;
}) {
  const db = getDb();
  const now = new Date();
  const currentTaskKeys = input.tasks.map((task) => task.taskKey);

  await db.transaction(async (tx) => {
    if (currentTaskKeys.length === 0) {
      await tx
        .delete(tenantScheduledTasks)
        .where(eq(tenantScheduledTasks.tenantId, input.tenantId));
    } else {
      await tx
        .delete(tenantScheduledTasks)
        .where(
          and(
            eq(tenantScheduledTasks.tenantId, input.tenantId),
            not(inArray(tenantScheduledTasks.taskKey, currentTaskKeys)),
          ),
        );
    }

    for (const task of input.tasks) {
      await tx
        .insert(tenantScheduledTasks)
        .values({
          tenantId: input.tenantId,
          taskKey: task.taskKey,
          name: task.name,
          description: task.description,
          status: task.status,
          enabled: task.enabled,
          scheduleKind: task.scheduleKind,
          scheduleExpression: task.scheduleExpression,
          timezone: task.timezone,
          sessionTarget: task.sessionTarget,
          nextRunAt: task.nextRunAt,
          lastRunAt: task.lastRunAt,
          lastRunStatus: task.lastRunStatus,
          lastError: task.lastError,
          runtimeUpdatedAt: task.runtimeUpdatedAt,
          lastSyncedAt: now,
          lastSyncError: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [tenantScheduledTasks.tenantId, tenantScheduledTasks.taskKey],
          set: {
            name: task.name,
            description: task.description,
            status: task.status,
            enabled: task.enabled,
            scheduleKind: task.scheduleKind,
            scheduleExpression: task.scheduleExpression,
            timezone: task.timezone,
            sessionTarget: task.sessionTarget,
            nextRunAt: task.nextRunAt,
            lastRunAt: task.lastRunAt,
            lastRunStatus: task.lastRunStatus,
            lastError: task.lastError,
            runtimeUpdatedAt: task.runtimeUpdatedAt,
            lastSyncedAt: now,
            lastSyncError: null,
            updatedAt: now,
          },
        });
    }

    const taskRows = await tx
      .select({
        id: tenantScheduledTasks.id,
        taskKey: tenantScheduledTasks.taskKey,
      })
      .from(tenantScheduledTasks)
      .where(eq(tenantScheduledTasks.tenantId, input.tenantId));

    const taskIdByKey = new Map(
      taskRows.map((row) => [row.taskKey, row.id] as const),
    );

    for (const run of input.runs) {
      await tx
        .insert(tenantScheduledTaskSessions)
        .values({
          tenantId: input.tenantId,
          tenantScheduledTaskId: taskIdByKey.get(run.taskKey) ?? null,
          taskKey: run.taskKey,
          taskName: run.taskName,
          externalRunKey: run.externalRunKey,
          externalSessionId: run.externalSessionId,
          runtimeSessionKey: run.runtimeSessionKey,
          triggerType: run.triggerType,
          scheduledFor: run.scheduledFor,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          status: run.status,
          summary: run.summary,
          error: run.error,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            tenantScheduledTaskSessions.tenantId,
            tenantScheduledTaskSessions.externalRunKey,
          ],
          set: {
            tenantScheduledTaskId: taskIdByKey.get(run.taskKey) ?? null,
            taskKey: run.taskKey,
            taskName: run.taskName,
            externalSessionId: run.externalSessionId,
            runtimeSessionKey: run.runtimeSessionKey,
            triggerType: run.triggerType,
            scheduledFor: run.scheduledFor,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            status: run.status,
            summary: run.summary,
            error: run.error,
            updatedAt: now,
          },
        });
    }
  });
}

export async function markTenantScheduledTasksSyncFailed(input: {
  error: string;
  tenantId: string;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .update(tenantScheduledTasks)
    .set({
      status: "sync_failed",
      lastSyncError: input.error,
      updatedAt: now,
    })
    .where(eq(tenantScheduledTasks.tenantId, input.tenantId));
}

export async function listTenantScheduledTasks(input: { tenantId: string }) {
  const db = getDb();

  return db
    .select({
      id: tenantScheduledTasks.id,
      taskKey: tenantScheduledTasks.taskKey,
      name: tenantScheduledTasks.name,
      description: tenantScheduledTasks.description,
      status: tenantScheduledTasks.status,
      enabled: tenantScheduledTasks.enabled,
      scheduleKind: tenantScheduledTasks.scheduleKind,
      scheduleExpression: tenantScheduledTasks.scheduleExpression,
      timezone: tenantScheduledTasks.timezone,
      sessionTarget: tenantScheduledTasks.sessionTarget,
      nextRunAt: tenantScheduledTasks.nextRunAt,
      lastRunAt: tenantScheduledTasks.lastRunAt,
      lastRunStatus: tenantScheduledTasks.lastRunStatus,
      lastError: tenantScheduledTasks.lastError,
      lastSyncedAt: tenantScheduledTasks.lastSyncedAt,
      lastSyncError: tenantScheduledTasks.lastSyncError,
      updatedAt: tenantScheduledTasks.updatedAt,
    })
    .from(tenantScheduledTasks)
    .where(eq(tenantScheduledTasks.tenantId, input.tenantId))
    .orderBy(tenantScheduledTasks.name);
}

export async function listTenantScheduledTaskSessions(input: {
  limit?: number;
  tenantId: string;
}) {
  const db = getDb();
  const limit = input.limit ?? 50;

  return db
    .select({
      id: tenantScheduledTaskSessions.id,
      taskKey: tenantScheduledTaskSessions.taskKey,
      taskName: tenantScheduledTaskSessions.taskName,
      externalSessionId: tenantScheduledTaskSessions.externalSessionId,
      runtimeSessionKey: tenantScheduledTaskSessions.runtimeSessionKey,
      triggerType: tenantScheduledTaskSessions.triggerType,
      scheduledFor: tenantScheduledTaskSessions.scheduledFor,
      startedAt: tenantScheduledTaskSessions.startedAt,
      finishedAt: tenantScheduledTaskSessions.finishedAt,
      status: tenantScheduledTaskSessions.status,
      summary: tenantScheduledTaskSessions.summary,
      error: tenantScheduledTaskSessions.error,
    })
    .from(tenantScheduledTaskSessions)
    .where(eq(tenantScheduledTaskSessions.tenantId, input.tenantId))
    .orderBy(
      desc(tenantScheduledTaskSessions.startedAt),
      desc(tenantScheduledTaskSessions.createdAt),
    )
    .limit(limit);
}

export async function getLatestTenantScheduledTasksRefreshJob(input: {
  tenantId: string;
}) {
  const db = getDb();

  const [job] = await db
    .select({
      id: jobRuns.id,
      status: jobRuns.status,
      error: jobRuns.error,
      createdAt: jobRuns.createdAt,
      startedAt: jobRuns.startedAt,
      finishedAt: jobRuns.finishedAt,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.tenantId, input.tenantId),
        eq(jobRuns.jobType, JOB_TYPES.reconcileTenantScheduledTasks),
      ),
    )
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);

  return job ?? null;
}

export function isScheduledTaskStale(lastSyncedAt: Date | null) {
  if (!lastSyncedAt) {
    return true;
  }

  return Date.now() - lastSyncedAt.getTime() > SCHEDULED_TASKS_STALE_AFTER_MS;
}
