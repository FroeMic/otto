import { z } from "zod"

const workspaceDateTimePreferencesSchema = z.object({
  locale: z.string().min(1),
  timeFormatPreference: z.string().min(1),
  timeZone: z.string().min(1),
})

const jsonRecordSchema = z.record(z.string(), z.unknown())

const scheduledTaskSchema = z.object({
  agentId: z.string().nullable(),
  deleteAfterRun: z.boolean(),
  deliveryJson: jsonRecordSchema.nullable(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  failureAlertJson: jsonRecordSchema.nullable(),
  id: z.string(),
  lastError: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: z.string().nullable(),
  lastSyncError: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  name: z.string().min(1),
  nextRunAt: z.string().nullable(),
  payloadJson: jsonRecordSchema.nullable(),
  scheduleExpression: z.string().min(1),
  scheduleJson: jsonRecordSchema.nullable(),
  scheduleKind: z.string().min(1),
  sessionKey: z.string().nullable(),
  sessionTarget: z.string().nullable(),
  status: z.string().min(1),
  taskKey: z.string().min(1),
  timezone: z.string().nullable(),
  updatedAt: z.string().nullable(),
  wakeMode: z.string().nullable(),
})

const scheduledTaskRunSchema = z.object({
  error: z.string().nullable(),
  externalSessionId: z.string().nullable(),
  finishedAt: z.string().nullable(),
  hasSyncedSession: z.boolean(),
  id: z.string(),
  runtimeSessionKey: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  startedAt: z.string().nullable(),
  status: z.string().min(1),
  summary: z.string().nullable(),
  taskKey: z.string().min(1),
  taskName: z.string().min(1),
  triggerType: z.string().min(1),
})

const scheduledTasksRefreshJobSchema = z.object({
  createdAt: z.string(),
  error: z.string().nullable(),
  finishedAt: z.string().nullable(),
  id: z.string(),
  startedAt: z.string().nullable(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
})

export const workspaceScheduledTasksListResponseSchema = z.object({
  dateTimePreferences: workspaceDateTimePreferencesSchema,
  latestRefreshJob: scheduledTasksRefreshJobSchema.nullable(),
  latestSyncedAt: z.string().nullable(),
  state: z.enum(["pending_setup", "ready"]),
  tasks: z.array(scheduledTaskSchema),
})

export const workspaceScheduledTaskRunsResponseSchema = z.object({
  dateTimePreferences: workspaceDateTimePreferencesSchema,
  latestRefreshJob: scheduledTasksRefreshJobSchema.nullable(),
  latestSyncedAt: z.string().nullable(),
  runs: z.array(scheduledTaskRunSchema),
  state: z.enum(["pending_setup", "ready"]),
})

export const workspaceScheduledTaskDetailResponseSchema = z.object({
  dateTimePreferences: workspaceDateTimePreferencesSchema,
  latestRefreshJob: scheduledTasksRefreshJobSchema.nullable(),
  latestSyncedAt: z.string().nullable(),
  runs: z.array(scheduledTaskRunSchema),
  state: z.enum(["pending_setup", "ready"]),
  task: scheduledTaskSchema.nullable(),
})

export const workspaceScheduledTasksRefreshResponseSchema = z.object({
  jobId: z.string().min(1),
  ok: z.literal(true),
})

export type WorkspaceScheduledTasksListResponse = z.infer<
  typeof workspaceScheduledTasksListResponseSchema
>
export type WorkspaceScheduledTaskRunsResponse = z.infer<
  typeof workspaceScheduledTaskRunsResponseSchema
>
export type WorkspaceScheduledTaskDetailResponse = z.infer<
  typeof workspaceScheduledTaskDetailResponseSchema
>
export type WorkspaceScheduledTasksRefreshResponse = z.infer<
  typeof workspaceScheduledTasksRefreshResponseSchema
>
