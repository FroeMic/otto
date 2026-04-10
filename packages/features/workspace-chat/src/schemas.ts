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
  slug: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  visibility: workspaceChatConversationVisibilitySchema,
})

export const workspaceChatMessageSchema = z.object({
  author: workspaceChatMessageAuthorSchema,
  createdAt: z.string().trim().min(1),
  id: z.string().trim().min(1),
  parts: z.array(workspaceChatMessagePartSchema).min(1),
  status: workspaceChatMessageStatusSchema,
})

export const workspaceChatConversationListResponseSchema = z.object({
  conversations: z.array(workspaceChatConversationSummarySchema),
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
  messages: z.array(workspaceChatMessageSchema),
})

export const workspaceChatMessageCreateRequestSchema = z.object({
  clientMessageId: z.string().trim().min(1).optional(),
  parts: z.array(workspaceChatMessagePartSchema).min(1),
})

export const workspaceChatMessageCreateResponseSchema = z.object({
  conversationId: z.string().trim().min(1),
  dispatch: z.object({
    status: z.enum(["pending_runtime_bridge", "queued", "sent"]),
  }),
  message: workspaceChatMessageSchema,
})

export const workspaceChatRuntimeSessionStatusSchema = z.enum([
  "active",
  "completed",
  "failed",
])

export const workspaceChatRuntimeMessageCompleteRequestSchema = z.object({
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

export const workspaceChatRuntimeMessageCompleteResponseSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  ok: z.literal(true),
  runtimeSegmentId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
})

export type WorkspaceChatConversationSummary = z.infer<
  typeof workspaceChatConversationSummarySchema
>
export type WorkspaceChatConversationCreateRequest = z.infer<
  typeof workspaceChatConversationCreateRequestSchema
>
export type WorkspaceChatConversationDetailResponse = z.infer<
  typeof workspaceChatConversationDetailResponseSchema
>
export type WorkspaceChatMessage = z.infer<typeof workspaceChatMessageSchema>
export type WorkspaceChatMessageCreateRequest = z.infer<
  typeof workspaceChatMessageCreateRequestSchema
>
export type WorkspaceChatMessageCreateResponse = z.infer<
  typeof workspaceChatMessageCreateResponseSchema
>
export type WorkspaceChatMessagePart = z.infer<
  typeof workspaceChatMessagePartSchema
>
export type WorkspaceChatRuntimeMessageCompleteRequest = z.infer<
  typeof workspaceChatRuntimeMessageCompleteRequestSchema
>
export type WorkspaceChatRuntimeMessageCompleteResponse = z.infer<
  typeof workspaceChatRuntimeMessageCompleteResponseSchema
>
