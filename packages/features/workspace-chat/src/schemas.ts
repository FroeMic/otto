import * as z from "zod"

export const workspaceChatConversationKindSchema = z.enum([
  "ad_hoc",
  "durable_named",
  "external_surface",
])

export const workspaceChatConversationVisibilitySchema = z.enum([
  "open",
  "personal",
])

export const workspaceChatConversationOriginKindSchema = z.enum([
  "manual",
  "scheduled",
  "trigger",
])

export const workspaceChatMessageAuthorKindSchema = z.enum([
  "user",
  "assistant",
  "system",
  "automation",
  "external",
])

export const workspaceChatMessageStatusSchema = z.enum([
  "pending",
  "streaming",
  "completed",
  "failed",
  "canceled",
])

export const workspaceChatMessageEventTypeSchema = z.enum([
  "lifecycle.started",
  "lifecycle.completed",
  "lifecycle.failed",
  "assistant_message.started",
  "assistant_message.filtered",
  "item.started",
  "item.updated",
  "item.completed",
  "item.failed",
  "tool.started",
  "tool.updated",
  "tool.completed",
  "tool.failed",
  "tool.result",
  "approval.requested",
  "approval.resolved",
  "command_output.delta",
  "command_output.completed",
  "thinking.started",
  "thinking.delta",
  "thinking.completed",
  "compaction.started",
  "compaction.completed",
])

export const workspaceChatMessageEventStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "blocked",
  "approved",
  "denied",
  "unavailable",
])

export const workspaceChatTextPartSchema = z.object({
  text: z.string().trim().min(1),
  type: z.literal("text"),
})

export const workspaceChatFilePartSchema = z.object({
  attachmentId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  type: z.literal("file"),
})

export const workspaceChatAudioPartSchema = z.object({
  attachmentId: z.string().trim().min(1),
  durationMs: z.number().int().positive().optional(),
  mimeType: z.string().trim().min(1),
  transcript: z.string().trim().min(1).optional(),
  type: z.literal("audio"),
})

export const workspaceChatMessagePartSchema = z.discriminatedUnion("type", [
  workspaceChatTextPartSchema,
  workspaceChatFilePartSchema,
  workspaceChatAudioPartSchema,
])

export const workspaceChatAttachmentSchema = z.object({
  fileName: z.string().trim().min(1),
  id: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
})

export const workspaceChatMessageAuthorSchema = z.object({
  kind: workspaceChatMessageAuthorKindSchema,
  name: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
})

export const workspaceChatConversationSummarySchema = z.object({
  id: z.string().trim().min(1),
  kind: workspaceChatConversationKindSchema,
  lastActivityAt: z.string().trim().min(1),
  latestMessagePreview: z.string().nullable(),
  originKind: workspaceChatConversationOriginKindSchema,
  slug: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  visibility: workspaceChatConversationVisibilitySchema,
})

export const workspaceChatConversationListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const workspaceChatMessageSchema = z.object({
  author: workspaceChatMessageAuthorSchema,
  createdAt: z.string().trim().min(1),
  id: z.string().trim().min(1),
  parts: z.array(workspaceChatMessagePartSchema),
  status: workspaceChatMessageStatusSchema,
})

export const workspaceChatMessageEventSchema = z.object({
  conversationId: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  id: z.string().trim().min(1),
  itemId: z.string().trim().min(1).optional(),
  messageId: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()),
  runId: z.string().trim().min(1).optional(),
  runtimeSegmentId: z.string().trim().min(1).optional(),
  sequence: z.number().int().positive(),
  sessionKey: z.string().trim().min(1).optional(),
  status: workspaceChatMessageEventStatusSchema.optional(),
  summary: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  type: workspaceChatMessageEventTypeSchema,
})

export const workspaceChatConversationListResponseSchema = z.object({
  conversations: z.array(workspaceChatConversationSummarySchema),
  nextCursor: z.string().trim().min(1).nullable(),
})

export const workspaceChatConversationCreateRequestSchema = z.object({
  kind: z.enum(["ad_hoc", "durable_named"]),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  title: z.string().trim().min(1),
  visibility: workspaceChatConversationVisibilitySchema,
})

export const workspaceChatConversationCreateResponseSchema = z.object({
  conversation: workspaceChatConversationSummarySchema,
})

export const workspaceChatConversationDetailResponseSchema = z.object({
  conversation: workspaceChatConversationSummarySchema,
  messageEvents: z.array(workspaceChatMessageEventSchema),
  messages: z.array(workspaceChatMessageSchema),
})

export const workspaceChatMessageCreateRequestSchema = z.object({
  clientMessageId: z.string().trim().min(1).optional(),
  parts: z.array(workspaceChatMessagePartSchema).min(1),
})

export const workspaceChatMessageCreateResponseSchema = z.object({
  conversationId: z.string().trim().min(1),
  dispatch: z.object({
    status: z.enum(["queued", "failed", "sent"]),
  }),
  message: workspaceChatMessageSchema,
})

export const workspaceChatAttachmentUploadResponseSchema = z.object({
  attachment: workspaceChatAttachmentSchema,
})

export const workspaceChatRuntimeSessionStatusSchema = z.enum([
  "active",
  "completed",
  "failed",
])

export const workspaceChatRuntimeMessageCompleteRequestSchema = z.object({
  assistantMessageId: z.string().trim().min(1).optional(),
  assistantDisplayName: z.string().trim().min(1).optional(),
  conversationId: z.string().trim().min(1),
  message: z.object({
    parts: z.array(workspaceChatMessagePartSchema).min(1),
  }),
  session: z.object({
    endedAt: z.string().trim().min(1).optional(),
    externalSessionId: z.string().trim().min(1).optional(),
    sessionKey: z.string().trim().min(1),
    startedAt: z.string().trim().min(1).optional(),
    status: workspaceChatRuntimeSessionStatusSchema,
  }),
})

export const workspaceChatRuntimeMessageDeltaRequestSchema = z.object({
  assistantDisplayName: z.string().trim().min(1).optional(),
  assistantMessageId: z.string().trim().min(1),
  conversationId: z.string().trim().min(1),
  message: z.object({
    text: z.string(),
  }),
  sequence: z.number().int().positive(),
})

export const workspaceChatRuntimeMessageFailRequestSchema = z.object({
  assistantDisplayName: z.string().trim().min(1).optional(),
  assistantMessageId: z.string().trim().min(1),
  conversationId: z.string().trim().min(1),
  error: z.string().trim().min(1).optional(),
})

export const workspaceChatRuntimeMessageEventMutationSchema = z.object({
  itemId: z.string().trim().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
  runId: z.string().trim().min(1).optional(),
  runtimeSegmentId: z.string().trim().min(1).optional(),
  sequence: z.number().int().positive(),
  sessionKey: z.string().trim().min(1).optional(),
  status: workspaceChatMessageEventStatusSchema.optional(),
  summary: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  type: workspaceChatMessageEventTypeSchema,
})

export const workspaceChatRuntimeMessageEventUpsertRequestSchema = z.object({
  assistantMessageId: z.string().trim().min(1),
  conversationId: z.string().trim().min(1),
  event: workspaceChatRuntimeMessageEventMutationSchema,
})

export const workspaceChatRuntimeMessageCompleteResponseSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  ok: z.literal(true),
  runtimeSegmentId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
})

export const workspaceChatRuntimeMessageDeltaResponseSchema = z.object({
  applied: z.boolean(),
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  ok: z.literal(true),
  tenantId: z.string().trim().min(1),
})

export const workspaceChatRuntimeMessageFailResponseSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  ok: z.literal(true),
  tenantId: z.string().trim().min(1),
})

export const workspaceChatRuntimeIngressRequestSchema = z.object({
  assistantMessageId: z.string().trim().min(1).optional(),
  conversationId: z.string().trim().min(1),
  conversationKind: workspaceChatConversationKindSchema,
  conversationTitle: z.string().trim().min(1),
  conversationVisibility: workspaceChatConversationVisibilitySchema,
  parts: z.array(workspaceChatMessagePartSchema).min(1),
  senderDisplayName: z.string().trim().min(1),
  senderExternalId: z.string().trim().min(1),
  userMessageId: z.string().trim().min(1).optional(),
})

export const workspaceChatRuntimeIngressAcceptanceResponseSchema = z.object({
  accepted: z.literal(true),
  ok: z.literal(true),
  sessionKey: z.string().trim().min(1),
})

export const workspaceChatRuntimeMessageEventUpsertResponseSchema = z.object({
  conversationId: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  ok: z.literal(true),
  tenantId: z.string().trim().min(1),
})

export type WorkspaceChatConversationSummary = z.infer<
  typeof workspaceChatConversationSummarySchema
>
export type WorkspaceChatConversationListQuery = z.infer<
  typeof workspaceChatConversationListQuerySchema
>
export type WorkspaceChatConversationListResponse = z.infer<
  typeof workspaceChatConversationListResponseSchema
>
export type WorkspaceChatConversationCreateRequest = z.infer<
  typeof workspaceChatConversationCreateRequestSchema
>
export type WorkspaceChatConversationDetailResponse = z.infer<
  typeof workspaceChatConversationDetailResponseSchema
>
export type WorkspaceChatMessageEvent = z.infer<
  typeof workspaceChatMessageEventSchema
>
export type WorkspaceChatMessage = z.infer<typeof workspaceChatMessageSchema>
export type WorkspaceChatMessageCreateRequest = z.infer<
  typeof workspaceChatMessageCreateRequestSchema
>
export type WorkspaceChatMessageCreateResponse = z.infer<
  typeof workspaceChatMessageCreateResponseSchema
>
export type WorkspaceChatAttachment = z.infer<
  typeof workspaceChatAttachmentSchema
>
export type WorkspaceChatAttachmentUploadResponse = z.infer<
  typeof workspaceChatAttachmentUploadResponseSchema
>
export type WorkspaceChatMessagePart = z.infer<
  typeof workspaceChatMessagePartSchema
>
export type WorkspaceChatRuntimeMessageCompleteRequest = z.infer<
  typeof workspaceChatRuntimeMessageCompleteRequestSchema
>
export type WorkspaceChatRuntimeMessageDeltaRequest = z.infer<
  typeof workspaceChatRuntimeMessageDeltaRequestSchema
>
export type WorkspaceChatRuntimeMessageFailRequest = z.infer<
  typeof workspaceChatRuntimeMessageFailRequestSchema
>
export type WorkspaceChatRuntimeMessageEventMutation = z.infer<
  typeof workspaceChatRuntimeMessageEventMutationSchema
>
export type WorkspaceChatRuntimeMessageEventUpsertRequest = z.infer<
  typeof workspaceChatRuntimeMessageEventUpsertRequestSchema
>
export type WorkspaceChatRuntimeMessageCompleteResponse = z.infer<
  typeof workspaceChatRuntimeMessageCompleteResponseSchema
>
export type WorkspaceChatRuntimeMessageDeltaResponse = z.infer<
  typeof workspaceChatRuntimeMessageDeltaResponseSchema
>
export type WorkspaceChatRuntimeMessageFailResponse = z.infer<
  typeof workspaceChatRuntimeMessageFailResponseSchema
>
export type WorkspaceChatRuntimeIngressRequest = z.infer<
  typeof workspaceChatRuntimeIngressRequestSchema
>
export type WorkspaceChatRuntimeIngressAcceptanceResponse = z.infer<
  typeof workspaceChatRuntimeIngressAcceptanceResponseSchema
>
export type WorkspaceChatRuntimeMessageEventUpsertResponse = z.infer<
  typeof workspaceChatRuntimeMessageEventUpsertResponseSchema
>
