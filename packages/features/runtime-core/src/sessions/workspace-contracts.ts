import { z } from "zod"

const workspaceDateTimePreferencesSchema = z.object({
  locale: z.string().min(1),
  timeFormatPreference: z.string().min(1),
  timeZone: z.string().min(1),
})

const tenantSessionListEntrySchema = z.object({
  createdAt: z.string().nullable(),
  displayName: z.string().nullable(),
  endedAt: z.string().nullable(),
  estimatedCostUsd: z.string().nullable(),
  externalSessionId: z.string().nullable(),
  id: z.string(),
  inputTokens: z.number().int().nullable(),
  label: z.string().nullable(),
  lastMessageAt: z.number().int().nullable(),
  lastSyncedAt: z.string().nullable(),
  messageCount: z.number().int().nullable(),
  model: z.string().nullable(),
  modelProvider: z.string().nullable(),
  originFrom: z.string().nullable(),
  parentSessionKey: z.string().nullable(),
  runtimeMs: z.number().int().nullable(),
  sessionKey: z.string().min(1),
  sessionUpdatedAt: z.number().int().nullable(),
  spawnDepth: z.number().int().nullable(),
  startedAt: z.string().nullable(),
  status: z.string().min(1),
  subject: z.string().nullable(),
  subagentRole: z.string().nullable(),
  totalTokens: z.number().int().nullable(),
})

const tenantSessionDetailSchema = z.object({
  channel: z.string().nullable(),
  channelProvider: z.string().nullable(),
  chatType: z.string().nullable(),
  displayName: z.string().nullable(),
  endedAt: z.string().nullable(),
  estimatedCostUsd: z.string().nullable(),
  externalSessionId: z.string().nullable(),
  id: z.string(),
  inputTokens: z.number().int().nullable(),
  label: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  messageCount: z.number().int().nullable(),
  model: z.string().nullable(),
  modelProvider: z.string().nullable(),
  originFrom: z.string().nullable(),
  runtimeMs: z.number().int().nullable(),
  sessionKey: z.string().min(1),
  startedAt: z.string().nullable(),
  status: z.string().min(1),
  subject: z.string().nullable(),
  totalTokens: z.number().int().nullable(),
  transcriptJsonl: z.string().nullable(),
})

export const workspaceSessionsListResponseSchema = z.object({
  channelNames: z.record(z.string(), z.string()),
  cronTaskKeys: z.record(z.string(), z.string()),
  currentUserExternalIds: z.array(z.string()),
  dateTimePreferences: workspaceDateTimePreferencesSchema,
  memberNames: z.record(z.string(), z.string()),
  sessions: z.array(tenantSessionListEntrySchema),
  state: z.enum(["pending_setup", "ready"]),
})

export const workspaceSessionDetailResponseSchema = z.object({
  channelNames: z.record(z.string(), z.string()),
  cronTaskHref: z.string().nullable(),
  currentUserExternalIds: z.array(z.string()),
  dateTimePreferences: workspaceDateTimePreferencesSchema,
  memberNames: z.record(z.string(), z.string()),
  session: tenantSessionDetailSchema.nullable(),
  state: z.enum(["pending_setup", "ready"]),
})

export const workspaceSessionsRefreshResponseSchema = z.object({
  jobId: z.string().min(1),
  ok: z.literal(true),
})

export type WorkspaceSessionsListResponse = z.infer<
  typeof workspaceSessionsListResponseSchema
>
export type WorkspaceSessionDetailResponse = z.infer<
  typeof workspaceSessionDetailResponseSchema
>
export type WorkspaceSessionsRefreshResponse = z.infer<
  typeof workspaceSessionsRefreshResponseSchema
>
