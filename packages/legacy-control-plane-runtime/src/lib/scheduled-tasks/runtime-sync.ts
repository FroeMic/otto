import type {
  ScheduledTaskSessionSnapshotRow,
  ScheduledTaskSnapshotRow,
} from "../../db/scheduled-tasks";

export type RuntimeCronJob = {
  agentId?: string;
  description?: string;
  deleteAfterRun?: boolean;
  delivery?: Record<string, unknown>;
  enabled?: boolean;
  failureAlert?: Record<string, unknown> | false;
  id?: string;
  name?: string;
  payload?: Record<string, unknown>;
  schedule?: Record<string, unknown>;
  sessionKey?: string;
  sessionTarget?: string;
  state?: Record<string, unknown>;
  updatedAtMs?: number;
  wakeMode?: string;
};

export type RuntimeCronRun = {
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

export function normalizeRuntimeTask(
  task: RuntimeCronJob,
): ScheduledTaskSnapshotRow | null {
  if (!task.id || !task.name) {
    return null;
  }

  const schedule = asRecord(task.schedule);
  const state = asRecord(task.state);
  const enabled = task.enabled !== false;

  return {
    agentId: readOptionalString(task.agentId),
    taskKey: task.id,
    name: task.name,
    description: readOptionalString(task.description),
    status: enabled ? "active" : "paused",
    enabled,
    scheduleKind: readScheduleKind(schedule),
    scheduleExpression: formatScheduleExpression(schedule),
    scheduleJson: schedule,
    timezone: readOptionalString(schedule?.tz),
    payloadJson: asRecord(task.payload),
    deliveryJson: asRecord(task.delivery),
    failureAlertJson: asRecord(task.failureAlert),
    wakeMode: readOptionalString(task.wakeMode),
    deleteAfterRun: task.deleteAfterRun === true,
    sessionKey: readOptionalString(task.sessionKey),
    sessionTarget: readOptionalString(task.sessionTarget),
    nextRunAt: toDateFromMs(state?.nextRunAtMs),
    lastRunAt: toDateFromMs(state?.lastRunAtMs),
    lastRunStatus: readOptionalString(state?.lastRunStatus),
    lastError: readOptionalString(state?.lastError),
    runtimeUpdatedAt:
      typeof task.updatedAtMs === "number" ? task.updatedAtMs : null,
  };
}

export function normalizeRuntimeRun(
  run: RuntimeCronRun,
  options?: {
    taskKey?: string | null;
    taskName?: string | null;
  },
): ScheduledTaskSessionSnapshotRow | null {
  const taskKey =
    options?.taskKey ??
    (typeof run.jobId === "string" && run.jobId.trim().length > 0
      ? run.jobId
      : null);

  if (!taskKey || typeof run.ts !== "number") {
    return null;
  }

  const finishedAt = new Date(run.ts);
  const durationMs =
    typeof run.durationMs === "number" && run.durationMs >= 0
      ? run.durationMs
      : null;

  return {
    taskKey,
    taskName: options?.taskName ?? readOptionalString(run.jobName) ?? taskKey,
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

export function buildRunKey(run: RuntimeCronRun) {
  return [
    run.jobId ?? "unknown",
    typeof run.runAtMs === "number" ? String(run.runAtMs) : "unknown",
    typeof run.ts === "number" ? String(run.ts) : "unknown",
    readOptionalString(run.sessionId) ??
      readOptionalString(run.sessionKey) ??
      "",
  ].join(":");
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
