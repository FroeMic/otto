export type ScheduledTaskSnapshotRow = {
  agentId: string | null
  deleteAfterRun: boolean
  deliveryJson: Record<string, unknown> | null
  description: string | null
  enabled: boolean
  failureAlertJson: Record<string, unknown> | null
  lastError: string | null
  lastRunAt: Date | null
  lastRunStatus: string | null
  name: string
  nextRunAt: Date | null
  payloadJson: Record<string, unknown> | null
  runtimeUpdatedAt: number | null
  scheduleExpression: string
  scheduleJson: Record<string, unknown> | null
  scheduleKind: string
  sessionKey: string | null
  sessionTarget: string | null
  status: string
  taskKey: string
  timezone: string | null
  wakeMode: string | null
}

export type ScheduledTaskSessionSnapshotRow = {
  error: string | null
  externalRunKey: string
  externalSessionId: string | null
  finishedAt: Date | null
  runtimeSessionKey: string | null
  scheduledFor: Date | null
  startedAt: Date | null
  status: string
  summary: string | null
  taskKey: string
  taskName: string
  triggerType: string
}

export type RuntimeCronJob = {
  agentId?: string
  deleteAfterRun?: boolean
  delivery?: Record<string, unknown>
  description?: string
  enabled?: boolean
  failureAlert?: Record<string, unknown> | false
  id?: string
  name?: string
  payload?: Record<string, unknown>
  schedule?: Record<string, unknown>
  sessionKey?: string
  sessionTarget?: string
  state?: Record<string, unknown>
  updatedAtMs?: number
  wakeMode?: string
}

export type RuntimeCronRun = {
  durationMs?: number
  error?: string
  jobId?: string
  jobName?: string
  runAtMs?: number
  sessionId?: string
  sessionKey?: string
  status?: string
  summary?: string
  ts?: number
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function toDateFromMs(value: unknown) {
  return typeof value === "number" ? new Date(value) : null
}

function readScheduleKind(schedule: Record<string, unknown> | null) {
  const kind = schedule?.kind
  if (kind === "at" || kind === "every" || kind === "cron") {
    return kind
  }
  return "unknown"
}

function formatDurationMs(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)

  return parts.join(" ")
}

function formatScheduleExpression(schedule: Record<string, unknown> | null) {
  if (!schedule) {
    return "Unknown schedule"
  }

  switch (schedule.kind) {
    case "cron": {
      const expr = readOptionalString(schedule.expr) ?? "Unknown cron"
      const tz = readOptionalString(schedule.tz)
      return tz ? `${expr} (${tz})` : expr
    }
    case "every": {
      const everyMs =
        typeof schedule.everyMs === "number" ? schedule.everyMs : null
      return everyMs ? `Every ${formatDurationMs(everyMs)}` : "Recurring"
    }
    case "at": {
      const at = readOptionalString(schedule.at)
      if (!at) {
        return "One-time"
      }
      const date = new Date(at)
      return Number.isNaN(date.getTime())
        ? at
        : `At ${date.toISOString().replace("T", " ").slice(0, 16)} UTC`
    }
    default:
      return "Unknown schedule"
  }
}

function buildRunKey(run: RuntimeCronRun) {
  return [
    run.jobId ?? "unknown",
    typeof run.runAtMs === "number" ? String(run.runAtMs) : "unknown",
    typeof run.ts === "number" ? String(run.ts) : "unknown",
    readOptionalString(run.sessionId) ??
      readOptionalString(run.sessionKey) ??
      "",
  ].join(":")
}

function mapRunStatus(status: string | undefined) {
  switch (status) {
    case "ok":
      return "succeeded"
    case "error":
      return "failed"
    case "skipped":
      return "skipped"
    default:
      return "unknown"
  }
}

export function normalizeRuntimeTask(
  task: RuntimeCronJob,
): ScheduledTaskSnapshotRow | null {
  if (!task.id || !task.name) {
    return null
  }

  const schedule = asRecord(task.schedule)
  const state = asRecord(task.state)
  const enabled = task.enabled !== false

  return {
    agentId: readOptionalString(task.agentId),
    deleteAfterRun: task.deleteAfterRun === true,
    deliveryJson: asRecord(task.delivery),
    description: readOptionalString(task.description),
    enabled,
    failureAlertJson: asRecord(task.failureAlert),
    lastError: readOptionalString(state?.lastError),
    lastRunAt: toDateFromMs(state?.lastRunAtMs),
    lastRunStatus: readOptionalString(state?.lastRunStatus),
    name: task.name,
    nextRunAt: toDateFromMs(state?.nextRunAtMs),
    payloadJson: asRecord(task.payload),
    runtimeUpdatedAt:
      typeof task.updatedAtMs === "number" ? task.updatedAtMs : null,
    scheduleExpression: formatScheduleExpression(schedule),
    scheduleJson: schedule,
    scheduleKind: readScheduleKind(schedule),
    sessionKey: readOptionalString(task.sessionKey),
    sessionTarget: readOptionalString(task.sessionTarget),
    status: enabled ? "active" : "paused",
    taskKey: task.id,
    timezone: readOptionalString(schedule?.tz),
    wakeMode: readOptionalString(task.wakeMode),
  }
}

export function normalizeRuntimeRun(
  run: RuntimeCronRun,
  options?: {
    taskKey?: string | null
    taskName?: string | null
  },
): ScheduledTaskSessionSnapshotRow | null {
  const taskKey =
    options?.taskKey ??
    (typeof run.jobId === "string" && run.jobId.trim().length > 0
      ? run.jobId
      : null)

  if (!taskKey || typeof run.ts !== "number") {
    return null
  }

  const finishedAt = new Date(run.ts)
  const durationMs =
    typeof run.durationMs === "number" && run.durationMs >= 0
      ? run.durationMs
      : null

  return {
    error: readOptionalString(run.error),
    externalRunKey: buildRunKey(run),
    externalSessionId: readOptionalString(run.sessionId),
    finishedAt,
    runtimeSessionKey: readOptionalString(run.sessionKey),
    scheduledFor: toDateFromMs(run.runAtMs),
    startedAt:
      durationMs === null
        ? finishedAt
        : new Date(finishedAt.getTime() - durationMs),
    status: mapRunStatus(run.status),
    summary: readOptionalString(run.summary),
    taskKey,
    taskName: options?.taskName ?? readOptionalString(run.jobName) ?? taskKey,
    triggerType: "scheduled",
  }
}
