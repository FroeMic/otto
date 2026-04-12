import * as z from "zod"

import {
  workspaceChatConversationSummarySchema,
  workspaceChatMessageEventSchema,
  workspaceChatMessageSchema,
} from "./schemas"

export const workspaceChatRealtimeClientMessageSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      conversationId: z.string().trim().min(1),
      type: z.literal("subscribe"),
    }),
    z.object({
      conversationId: z.string().trim().min(1),
      type: z.literal("unsubscribe"),
    }),
    z.object({
      type: z.literal("ping"),
    }),
  ],
)

export const workspaceChatRealtimeServerEventSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      conversationId: z.string().trim().min(1),
      event: workspaceChatMessageEventSchema,
      type: z.literal("conversation.message_event_upserted"),
    }),
    z.object({
      conversationId: z.string().trim().min(1),
      message: workspaceChatMessageSchema,
      type: z.literal("conversation.message_upserted"),
    }),
    z.object({
      conversation: workspaceChatConversationSummarySchema,
      type: z.literal("conversation.summary_updated"),
    }),
    z.object({
      conversationId: z.string().trim().min(1),
      type: z.literal("subscribed"),
    }),
    z.object({
      conversationId: z.string().trim().min(1),
      type: z.literal("unsubscribed"),
    }),
    z.object({
      conversationId: z.string().trim().min(1),
      type: z.literal("subscription_denied"),
    }),
    z.object({
      type: z.literal("pong"),
    }),
  ],
)

export type WorkspaceChatRealtimeClientMessage = z.infer<
  typeof workspaceChatRealtimeClientMessageSchema
>
export type WorkspaceChatRealtimeServerEvent = z.infer<
  typeof workspaceChatRealtimeServerEventSchema
>

export type WorkspaceChatRealtimeEvent = WorkspaceChatRealtimeServerEvent
