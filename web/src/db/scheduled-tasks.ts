import { and, desc, eq, inArray, not } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  jobRuns,
  tenantScheduledTaskSessions,
  tenantScheduledTasks,
  tenantSessions,
} from "@/db/schema";
import { JOB_TYPES } from "@/lib/jobs/types";

export const SCHEDULED_TASKS_STALE_AFTER_MS = 15 * 60 * 1000;

export type ScheduledTaskSnapshotRow = {
  agentId: string | null;
  description: string | null;
  deleteAfterRun: boolean;
  deliveryJson: Record<string, unknown> | null;
  enabled: boolean;
  failureAlertJson: Record<string, unknown> | null;
  lastError: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  name: string;
  nextRunAt: Date | null;
  payloadJson: Record<string, unknown> | null;
  runtimeUpdatedAt: number | null;
  scheduleExpression: string;
  scheduleKind: string;
  scheduleJson: Record<string, unknown> | null;
  sessionKey: string | null;
  sessionTarget: string | null;
  status: string;
  taskKey: string;
  timezone: string | null;
  wakeMode: string | null;
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

type DbClient = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export async function replaceTenantScheduledTasksSnapshot(input: {
  tasks: ScheduledTaskSnapshotRow[];
  tenantId: string;
}) {
  const db = getDb();

  await db.transaction(async (tx) => {
    await replaceTenantScheduledTasksSnapshotTx(tx, input);
  });
}

export async function upsertTenantScheduledTaskRuns(input: {
  runs: ScheduledTaskSessionSnapshotRow[];
  tenantId: string;
}) {
  if (input.runs.length === 0) {
    return;
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    await upsertTenantScheduledTaskRunsTx(tx, input);
  });
}

export async function upsertTenantScheduledTasksSnapshot(input: {
  runs: ScheduledTaskSessionSnapshotRow[];
  tasks: ScheduledTaskSnapshotRow[];
  tenantId: string;
}) {
  const db = getDb();

  await db.transaction(async (tx) => {
    await replaceTenantScheduledTasksSnapshotTx(tx, {
      tasks: input.tasks,
      tenantId: input.tenantId,
    });
    await upsertTenantScheduledTaskRunsTx(tx, {
      runs: input.runs,
      tenantId: input.tenantId,
    });
  });
}

async function replaceTenantScheduledTasksSnapshotTx(
  tx: DbClient | DbTransaction,
  input: {
    tasks: ScheduledTaskSnapshotRow[];
    tenantId: string;
  },
) {
  const now = new Date();
  const currentTaskKeys = input.tasks.map((task) => task.taskKey);

  if (currentTaskKeys.length === 0) {
    await markMissingTenantScheduledTasksDeletedTx(tx, {
      now,
      tenantId: input.tenantId,
    });
  } else {
    await markMissingTenantScheduledTasksDeletedTx(tx, {
      excludeTaskKeys: currentTaskKeys,
      now,
      tenantId: input.tenantId,
    });
  }

  for (const task of input.tasks) {
    await tx
      .insert(tenantScheduledTasks)
      .values({
        agentId: task.agentId,
        tenantId: input.tenantId,
        taskKey: task.taskKey,
        name: task.name,
        description: task.description,
        status: task.status,
        enabled: task.enabled,
        scheduleKind: task.scheduleKind,
        scheduleExpression: task.scheduleExpression,
        scheduleJson: task.scheduleJson,
        timezone: task.timezone,
        payloadJson: task.payloadJson,
        deliveryJson: task.deliveryJson,
        failureAlertJson: task.failureAlertJson,
        wakeMode: task.wakeMode,
        deleteAfterRun: task.deleteAfterRun,
        sessionKey: task.sessionKey,
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
          agentId: task.agentId,
          name: task.name,
          description: task.description,
          status: task.status,
          enabled: task.enabled,
          scheduleKind: task.scheduleKind,
          scheduleExpression: task.scheduleExpression,
          scheduleJson: task.scheduleJson,
          timezone: task.timezone,
          payloadJson: task.payloadJson,
          deliveryJson: task.deliveryJson,
          failureAlertJson: task.failureAlertJson,
          wakeMode: task.wakeMode,
          deleteAfterRun: task.deleteAfterRun,
          sessionKey: task.sessionKey,
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
}

async function upsertTenantScheduledTaskRunsTx(
  tx: DbClient | DbTransaction,
  input: {
    runs: ScheduledTaskSessionSnapshotRow[];
    tenantId: string;
  },
) {
  if (input.runs.length === 0) {
    return;
  }

  const now = new Date();
  const placeholderTaskRows = buildDeletedPlaceholderTasks(input.runs);

  for (const task of placeholderTaskRows) {
    await tx
      .insert(tenantScheduledTasks)
      .values({
        agentId: null,
        tenantId: input.tenantId,
        taskKey: task.taskKey,
        name: task.name,
        description: task.description,
        status: task.status,
        enabled: task.enabled,
        scheduleKind: task.scheduleKind,
        scheduleExpression: task.scheduleExpression,
        scheduleJson: task.scheduleJson,
        timezone: task.timezone,
        payloadJson: task.payloadJson,
        deliveryJson: task.deliveryJson,
        failureAlertJson: task.failureAlertJson,
        wakeMode: task.wakeMode,
        deleteAfterRun: task.deleteAfterRun,
        sessionKey: task.sessionKey,
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
      .onConflictDoNothing({
        target: [tenantScheduledTasks.tenantId, tenantScheduledTasks.taskKey],
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

  const latestRunByTaskKey = new Map<string, ScheduledTaskSessionSnapshotRow>();
  for (const run of input.runs) {
    const nextSortMs = getTaskRunSortMs(run);
    const current = latestRunByTaskKey.get(run.taskKey);
    const currentSortMs = current ? getTaskRunSortMs(current) : null;

    if (currentSortMs === null || nextSortMs > currentSortMs) {
      latestRunByTaskKey.set(run.taskKey, run);
    }
  }

  for (const [taskKey, run] of latestRunByTaskKey) {
    await tx
      .update(tenantScheduledTasks)
      .set({
        lastRunAt: run.finishedAt ?? run.startedAt ?? run.scheduledFor,
        lastRunStatus: run.status,
        lastError: run.error,
        lastSyncedAt: now,
        lastSyncError: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(tenantScheduledTasks.tenantId, input.tenantId),
          eq(tenantScheduledTasks.taskKey, taskKey),
        ),
      );
  }
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
      scheduleJson: tenantScheduledTasks.scheduleJson,
      timezone: tenantScheduledTasks.timezone,
      payloadJson: tenantScheduledTasks.payloadJson,
      deliveryJson: tenantScheduledTasks.deliveryJson,
      failureAlertJson: tenantScheduledTasks.failureAlertJson,
      wakeMode: tenantScheduledTasks.wakeMode,
      deleteAfterRun: tenantScheduledTasks.deleteAfterRun,
      agentId: tenantScheduledTasks.agentId,
      sessionKey: tenantScheduledTasks.sessionKey,
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
    .orderBy(tenantScheduledTasks.name)
    .then((rows) => rows.map(normalizeScheduledTaskRow));
}

export async function getTenantScheduledTask(input: {
  taskKey: string;
  tenantId: string;
}) {
  const db = getDb();

  const [task] = await db
    .select({
      id: tenantScheduledTasks.id,
      taskKey: tenantScheduledTasks.taskKey,
      name: tenantScheduledTasks.name,
      description: tenantScheduledTasks.description,
      status: tenantScheduledTasks.status,
      enabled: tenantScheduledTasks.enabled,
      scheduleKind: tenantScheduledTasks.scheduleKind,
      scheduleExpression: tenantScheduledTasks.scheduleExpression,
      scheduleJson: tenantScheduledTasks.scheduleJson,
      timezone: tenantScheduledTasks.timezone,
      payloadJson: tenantScheduledTasks.payloadJson,
      deliveryJson: tenantScheduledTasks.deliveryJson,
      failureAlertJson: tenantScheduledTasks.failureAlertJson,
      wakeMode: tenantScheduledTasks.wakeMode,
      deleteAfterRun: tenantScheduledTasks.deleteAfterRun,
      agentId: tenantScheduledTasks.agentId,
      sessionKey: tenantScheduledTasks.sessionKey,
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
    .where(
      and(
        eq(tenantScheduledTasks.tenantId, input.tenantId),
        eq(tenantScheduledTasks.taskKey, input.taskKey),
      ),
    )
    .limit(1);

  return task ? normalizeScheduledTaskRow(task) : null;
}

export async function listTenantScheduledTaskSessions(input: {
  limit?: number;
  taskKey?: string;
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
      hasSyncedSession: tenantSessions.id,
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
    );
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

function getTaskRunSortMs(run: ScheduledTaskSessionSnapshotRow) {
  return (
    run.finishedAt?.getTime() ??
    run.startedAt?.getTime() ??
    run.scheduledFor?.getTime() ??
    0
  );
}

async function markMissingTenantScheduledTasksDeletedTx(
  tx: DbClient | DbTransaction,
  input: {
    excludeTaskKeys?: string[];
    now: Date;
    tenantId: string;
  },
) {
  await tx
    .update(tenantScheduledTasks)
    .set({
      enabled: false,
      lastSyncError: null,
      lastSyncedAt: input.now,
      nextRunAt: null,
      status: "deleted",
      updatedAt: input.now,
    })
    .where(
      and(
        eq(tenantScheduledTasks.tenantId, input.tenantId),
        input.excludeTaskKeys && input.excludeTaskKeys.length > 0
          ? not(inArray(tenantScheduledTasks.taskKey, input.excludeTaskKeys))
          : undefined,
      ),
    );
}

function buildDeletedPlaceholderTasks(runs: ScheduledTaskSessionSnapshotRow[]) {
  const placeholderTasks = new Map<string, ScheduledTaskSnapshotRow>();

  for (const run of runs) {
    if (placeholderTasks.has(run.taskKey)) {
      continue;
    }

    placeholderTasks.set(run.taskKey, {
      agentId: null,
      description:
        "Runtime task definition was deleted before Otto synced its full configuration.",
      deleteAfterRun: true,
      deliveryJson: null,
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
      scheduleKind: "unknown",
      scheduleJson: null,
      sessionKey: null,
      sessionTarget: null,
      status: "deleted",
      taskKey: run.taskKey,
      timezone: null,
      wakeMode: null,
    });
  }

  return [...placeholderTasks.values()];
}

function normalizeScheduledTaskRow<
  TRow extends {
    deliveryJson: unknown;
    failureAlertJson: unknown;
    payloadJson: unknown;
    scheduleJson: unknown;
  },
>(row: TRow) {
  return {
    ...row,
    deliveryJson: asRecord(row.deliveryJson),
    failureAlertJson: asRecord(row.failureAlertJson),
    payloadJson: asRecord(row.payloadJson),
    scheduleJson: asRecord(row.scheduleJson),
  };
}

/**
 * Build a map from runtime session key → task key for cron sessions.
 * Used to link cron session rows in the sessions list to the correct
 * scheduled task detail page.
 */
export async function getCronSessionTaskKeyMap(input: {
  tenantId: string;
}): Promise<Map<string, string>> {
  const db = getDb();

  const rows = await db
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
    );

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.runtimeSessionKey) {
      map.set(row.runtimeSessionKey, row.taskKey);
    }
  }
  return map;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
