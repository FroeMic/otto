import {
  markTenantScheduledTasksSyncFailed,
  type ScheduledTaskSessionSnapshotRow,
  type ScheduledTaskSnapshotRow,
  upsertTenantScheduledTasksSnapshot,
} from "@/db/scheduled-tasks";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { RuntimeManager } from "@/lib/runtime/manager";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type ReconcileTenantScheduledTasksPayload,
} from "./types";

type RuntimeCronJob = {
  description?: string;
  enabled?: boolean;
  id?: string;
  name?: string;
  schedule?: Record<string, unknown>;
  sessionTarget?: string;
  state?: Record<string, unknown>;
  updatedAtMs?: number;
};

type RuntimeCronRun = {
  durationMs?: number;
  error?: string;
  jobId?: string;
  jobName?: string;
  runAtMs?: number;
  sessionId?: string;
  sessionKey?: string;
  status?: string;
  summary?: string;
  ts?: number;
};

const runtimeManager = new RuntimeManager();

export async function processReconcileTenantScheduledTasksJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.reconcileTenantScheduledTasks) {
    throw new Error(
      `Unsupported job type for scheduled-task sync handler: ${job.jobType}`,
    );
  }

  const payload = parsePayload(job.payload);

  try {
    await appendJobEvent(
      job.id,
      "connecting_runtime",
      "Connecting to tenant runtime",
    );

    const connection = await getTenantRuntimeConnection(
      payload.tenantId,
      "scheduled task refresh",
    );

    await appendJobEvent(
      job.id,
      "listing_scheduled_tasks",
      "Fetching scheduled tasks from runtime",
    );

    const tasksPage = await runtimeManager.invokeGatewayTool(connection, {
      action: "list",
      args: { includeDisabled: true },
      tool: "cron",
    });
    const runtimeTasks = readCronListEntries(tasksPage);

    await appendJobEvent(
      job.id,
      "fetching_task_runs",
      `Fetching recent runs for ${runtimeTasks.length} scheduled tasks`,
    );

    const runtimeRuns: RuntimeCronRun[] = [];
    for (const runtimeTask of runtimeTasks) {
      if (!runtimeTask.id) {
        continue;
      }

      const runsPage = await runtimeManager.invokeGatewayTool(connection, {
        action: "runs",
        args: { jobId: runtimeTask.id },
        tool: "cron",
      });
      runtimeRuns.push(...readCronRunEntries(runsPage));
    }

    const taskSnapshots = runtimeTasks
      .map(normalizeRuntimeTask)
      .filter((task): task is ScheduledTaskSnapshotRow => task !== null);
    const runsByTaskId = new Map<string, RuntimeCronRun[]>();

    for (const run of runtimeRuns) {
      const jobId = typeof run.jobId === "string" ? run.jobId : null;
      if (!jobId) {
        continue;
      }

      const entries = runsByTaskId.get(jobId) ?? [];
      entries.push(run);
      runsByTaskId.set(jobId, entries);
    }

    const runSnapshots: ScheduledTaskSessionSnapshotRow[] = [];
    for (const task of taskSnapshots) {
      const taskRuns = runsByTaskId.get(task.taskKey) ?? [];
      for (const run of taskRuns) {
        const snapshot = normalizeRuntimeRun(task, run);
        if (snapshot) {
          runSnapshots.push(snapshot);
        }
      }
    }

    await upsertTenantScheduledTasksSnapshot({
      runs: runSnapshots,
      tasks: taskSnapshots,
      tenantId: payload.tenantId,
    });

    await appendJobEvent(
      job.id,
      "succeeded",
      `Synced ${taskSnapshots.length} scheduled tasks and ${runSnapshots.length} runs`,
    );
    await markJobSucceeded(job.id, {
      syncedRuns: runSnapshots.length,
      syncedTasks: taskSnapshots.length,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await markTenantScheduledTasksSyncFailed({
      error: message,
      tenantId: payload.tenantId,
    });
    await appendJobEvent(
      job.id,
      "failed",
      `Scheduled task refresh failed: ${message}`,
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

function parsePayload(
  payload: Record<string, unknown>,
): ReconcileTenantScheduledTasksPayload {
  const tenantId = payload.tenantId;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Scheduled task refresh payload is missing tenantId");
  }

  return { tenantId };
}

export function readCronListEntries(
  payload: Record<string, unknown>,
): RuntimeCronJob[] {
  const jobs = readEntriesField(payload, "jobs");
  if (jobs) {
    return jobs as RuntimeCronJob[];
  }

  const entries = readEntriesField(payload, "entries");
  if (entries) {
    return entries as RuntimeCronJob[];
  }

  throw new Error(
    "Tenant runtime cron.list response did not include a jobs array",
  );
}

export function readCronRunEntries(
  payload: Record<string, unknown>,
): RuntimeCronRun[] {
  const entries = readEntriesField(payload, "entries");
  if (entries) {
    return entries as RuntimeCronRun[];
  }

  throw new Error(
    "Tenant runtime cron.runs response did not include an entries array",
  );
}

function readEntriesField(payload: Record<string, unknown>, field: string) {
  const entries = payload[field];
  if (!Array.isArray(entries)) {
    return null;
  }

  return entries.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}

function normalizeRuntimeTask(
  task: RuntimeCronJob,
): ScheduledTaskSnapshotRow | null {
  if (!task.id || !task.name) {
    return null;
  }

  const schedule = asRecord(task.schedule);
  const state = asRecord(task.state);
  const enabled = task.enabled !== false;

  return {
    taskKey: task.id,
    name: task.name,
    description: readOptionalString(task.description),
    status: enabled ? "active" : "paused",
    enabled,
    scheduleKind: readScheduleKind(schedule),
    scheduleExpression: formatScheduleExpression(schedule),
    timezone: readOptionalString(schedule?.tz),
    sessionTarget: readOptionalString(task.sessionTarget),
    nextRunAt: toDateFromMs(state?.nextRunAtMs),
    lastRunAt: toDateFromMs(state?.lastRunAtMs),
    lastRunStatus: readOptionalString(state?.lastRunStatus),
    lastError: readOptionalString(state?.lastError),
    runtimeUpdatedAt:
      typeof task.updatedAtMs === "number" ? task.updatedAtMs : null,
  };
}

function normalizeRuntimeRun(
  task: ScheduledTaskSnapshotRow,
  run: RuntimeCronRun,
): ScheduledTaskSessionSnapshotRow | null {
  if (typeof run.jobId !== "string" || typeof run.ts !== "number") {
    return null;
  }

  const finishedAt = new Date(run.ts);
  const durationMs =
    typeof run.durationMs === "number" && run.durationMs >= 0
      ? run.durationMs
      : null;

  return {
    taskKey: task.taskKey,
    taskName: readOptionalString(run.jobName) ?? task.name,
    externalRunKey: buildRunKey(run),
    externalSessionId: readOptionalString(run.sessionId),
    runtimeSessionKey: readOptionalString(run.sessionKey),
    triggerType: "scheduled",
    scheduledFor: toDateFromMs(run.runAtMs),
    startedAt:
      durationMs === null
        ? finishedAt
        : new Date(finishedAt.getTime() - durationMs),
    finishedAt,
    status: mapRunStatus(run.status),
    summary: readOptionalString(run.summary),
    error: readOptionalString(run.error),
  };
}

function buildRunKey(run: RuntimeCronRun) {
  return [
    run.jobId ?? "unknown",
    typeof run.runAtMs === "number" ? String(run.runAtMs) : "unknown",
    typeof run.ts === "number" ? String(run.ts) : "unknown",
    readOptionalString(run.sessionId) ??
      readOptionalString(run.sessionKey) ??
      "",
  ].join(":");
}

function readScheduleKind(schedule: Record<string, unknown> | null) {
  const kind = schedule?.kind;
  if (kind === "at" || kind === "every" || kind === "cron") {
    return kind;
  }

  return "unknown";
}

function formatScheduleExpression(schedule: Record<string, unknown> | null) {
  if (!schedule) {
    return "Unknown schedule";
  }

  switch (schedule.kind) {
    case "cron": {
      const expr = readOptionalString(schedule.expr) ?? "Unknown cron";
      const tz = readOptionalString(schedule.tz);
      return tz ? `${expr} (${tz})` : expr;
    }
    case "every": {
      const everyMs =
        typeof schedule.everyMs === "number" ? schedule.everyMs : null;
      return everyMs ? `Every ${formatDurationMs(everyMs)}` : "Recurring";
    }
    case "at": {
      const at = readOptionalString(schedule.at);
      if (!at) {
        return "One-time";
      }
      const date = new Date(at);
      return Number.isNaN(date.getTime())
        ? at
        : `At ${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
    }
    default:
      return "Unknown schedule";
  }
}

function formatDurationMs(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

function mapRunStatus(status: string | undefined) {
  switch (status) {
    case "ok":
      return "succeeded";
    case "error":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return "unknown";
  }
}

function toDateFromMs(value: unknown) {
  return typeof value === "number" ? new Date(value) : null;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
