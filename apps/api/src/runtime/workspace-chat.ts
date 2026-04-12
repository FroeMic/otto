import { jsonNoStore } from "@otto/auth"
import {
  type WorkspaceChatRuntimeMessageCompleteRequest,
  type WorkspaceChatRuntimeMessageDeltaRequest,
  type WorkspaceChatRuntimeMessageEventMutation,
  type WorkspaceChatRuntimeMessageFailRequest,
  workspaceChatRuntimeMessageCompleteRequestSchema,
  workspaceChatRuntimeMessageCompleteResponseSchema,
  workspaceChatRuntimeMessageDeltaRequestSchema,
  workspaceChatRuntimeMessageDeltaResponseSchema,
  workspaceChatRuntimeMessageEventUpsertRequestSchema,
  workspaceChatRuntimeMessageEventUpsertResponseSchema,
  workspaceChatRuntimeMessageFailRequestSchema,
  workspaceChatRuntimeMessageFailResponseSchema,
} from "@otto/feature-workspace-chat"
import { Hono } from "hono"
import * as z from "zod"
import {
  applyWorkspaceChatAssistantDelta,
  completeWorkspaceChatAssistantMessage,
  markWorkspaceChatAssistantMessageFailed,
  upsertWorkspaceChatAssistantEvent,
} from "../workspace/chat-data"

import { authenticateTenantRuntimeRequest } from "./auth"

export type WorkspaceChatRuntimeRouteDependencies = {
  authenticateTenantRuntime?: (request: Request) => Promise<{
    tenantId: string
  }>
  applyAssistantDelta: (payload: {
    assistantDisplayName?: string
    assistantMessageId: string
    conversationId: string
    sequence: number
    tenantId: string
    text: WorkspaceChatRuntimeMessageDeltaRequest["message"]["text"]
  }) => Promise<{
    applied: boolean
    conversationId: string
    messageId: string
    tenantId: string
  } | null>
  applyAssistantEvent?: (payload: {
    assistantMessageId: string
    conversationId: string
    event: WorkspaceChatRuntimeMessageEventMutation
    tenantId: string
  }) => Promise<{
    conversationId: string
    eventId: string
    messageId: string
    tenantId: string
  } | null>
  completeAssistantMessage: (payload: {
    assistantMessageId?: string
    assistantDisplayName?: string
    conversationId: string
    parts: WorkspaceChatRuntimeMessageCompleteRequest["message"]["parts"]
    session: WorkspaceChatRuntimeMessageCompleteRequest["session"]
    tenantId: string
  }) => Promise<{
    conversationId: string
    messageId: string
    runtimeSegmentId: string
    tenantId: string
  } | null>
  failAssistantMessage?: (payload: {
    assistantDisplayName?: string
    assistantMessageId: string
    conversationId: string
    error?: WorkspaceChatRuntimeMessageFailRequest["error"]
    tenantId: string
  }) => Promise<{
    conversationId: string
    messageId: string
    tenantId: string
  } | null>
}

function createDefaultWorkspaceChatRuntimeRouteDependencies(): WorkspaceChatRuntimeRouteDependencies {
  return {
    applyAssistantDelta: applyWorkspaceChatAssistantDelta,
    applyAssistantEvent: upsertWorkspaceChatAssistantEvent,
    authenticateTenantRuntime: authenticateTenantRuntimeRequest,
    completeAssistantMessage: completeWorkspaceChatAssistantMessage,
    failAssistantMessage: async (payload) => {
      await markWorkspaceChatAssistantMessageFailed({
        assistantMessageId: payload.assistantMessageId,
        conversationId: payload.conversationId,
      })

      return {
        conversationId: payload.conversationId,
        messageId: payload.assistantMessageId,
        tenantId: payload.tenantId,
      }
    },
  }
}

function buildWorkspaceChatRuntimeErrorResponse(error: unknown) {
  console.error("[workspace-chat] runtime callback request failed", {
    error:
      error instanceof Error
        ? error.message
        : error instanceof z.ZodError
          ? "Invalid workspace chat runtime payload"
          : "Workspace chat runtime request failed.",
  })

  if (error instanceof z.ZodError) {
    return jsonNoStore(
      {
        error: "Invalid workspace chat runtime payload",
        issues: error.issues,
      },
      400,
    )
  }

  if (error instanceof Error) {
    return jsonNoStore(
      {
        error: error.message,
      },
      400,
    )
  }

  return jsonNoStore(
    {
      error: "Workspace chat runtime request failed.",
    },
    500,
  )
}

export function createWorkspaceChatRuntimeRouter(
  dependencies: WorkspaceChatRuntimeRouteDependencies = createDefaultWorkspaceChatRuntimeRouteDependencies(),
) {
  const app = new Hono()

  app.post(
    "/api/internal/runtime/workspace-chat/messages/delta",
    async (context) => {
      try {
        const { tenantId } = await (dependencies.authenticateTenantRuntime
          ? dependencies.authenticateTenantRuntime(context.req.raw)
          : authenticateTenantRuntimeRequest(context.req.raw))
        const payload = workspaceChatRuntimeMessageDeltaRequestSchema.parse(
          await context.req.json(),
        )

        console.info("[workspace-chat] runtime delta callback received", {
          assistantMessageId: payload.assistantMessageId ?? null,
          conversationId: payload.conversationId,
          sequence: payload.sequence,
          tenantId,
          textLength: payload.message.text.length,
        })

        const result = await dependencies.applyAssistantDelta({
          assistantDisplayName: payload.assistantDisplayName,
          assistantMessageId: payload.assistantMessageId,
          conversationId: payload.conversationId,
          sequence: payload.sequence,
          tenantId,
          text: payload.message.text,
        })

        if (!result) {
          console.warn(
            "[workspace-chat] runtime delta callback target missing",
            {
              assistantMessageId: payload.assistantMessageId ?? null,
              conversationId: payload.conversationId,
              sequence: payload.sequence,
              tenantId,
            },
          )
          return jsonNoStore(
            {
              error:
                "Workspace chat conversation not found for this tenant runtime.",
            },
            404,
          )
        }

        console.info("[workspace-chat] runtime delta callback applied", {
          applied: result.applied,
          conversationId: result.conversationId,
          messageId: result.messageId,
          tenantId: result.tenantId,
        })

        return jsonNoStore(
          workspaceChatRuntimeMessageDeltaResponseSchema.parse({
            applied: result.applied,
            conversationId: result.conversationId,
            messageId: result.messageId,
            ok: true,
            tenantId: result.tenantId,
          }),
        )
      } catch (error) {
        return buildWorkspaceChatRuntimeErrorResponse(error)
      }
    },
  )

  app.post(
    "/api/internal/runtime/workspace-chat/messages/complete",
    async (context) => {
      try {
        const { tenantId } = await (dependencies.authenticateTenantRuntime
          ? dependencies.authenticateTenantRuntime(context.req.raw)
          : authenticateTenantRuntimeRequest(context.req.raw))
        const payload = workspaceChatRuntimeMessageCompleteRequestSchema.parse(
          await context.req.json(),
        )

        console.info("[workspace-chat] runtime completion callback received", {
          assistantMessageId: payload.assistantMessageId ?? null,
          conversationId: payload.conversationId,
          partsCount: payload.message.parts.length,
          tenantId,
        })

        const result = await dependencies.completeAssistantMessage({
          assistantMessageId: payload.assistantMessageId,
          assistantDisplayName: payload.assistantDisplayName,
          conversationId: payload.conversationId,
          parts: payload.message.parts,
          session: payload.session,
          tenantId,
        })

        if (!result) {
          console.warn(
            "[workspace-chat] runtime completion callback target missing",
            {
              assistantMessageId: payload.assistantMessageId ?? null,
              conversationId: payload.conversationId,
              tenantId,
            },
          )
          return jsonNoStore(
            {
              error:
                "Workspace chat conversation not found for this tenant runtime.",
            },
            404,
          )
        }

        console.info("[workspace-chat] runtime completion callback applied", {
          conversationId: result.conversationId,
          messageId: result.messageId,
          runtimeSegmentId: result.runtimeSegmentId,
          tenantId: result.tenantId,
        })

        return jsonNoStore(
          workspaceChatRuntimeMessageCompleteResponseSchema.parse({
            conversationId: result.conversationId,
            messageId: result.messageId,
            ok: true,
            runtimeSegmentId: result.runtimeSegmentId,
            tenantId: result.tenantId,
          }),
        )
      } catch (error) {
        return buildWorkspaceChatRuntimeErrorResponse(error)
      }
    },
  )

  app.post(
    "/api/internal/runtime/workspace-chat/messages/fail",
    async (context) => {
      try {
        const { tenantId } = await (dependencies.authenticateTenantRuntime
          ? dependencies.authenticateTenantRuntime(context.req.raw)
          : authenticateTenantRuntimeRequest(context.req.raw))
        const payload = workspaceChatRuntimeMessageFailRequestSchema.parse(
          await context.req.json(),
        )

        console.info("[workspace-chat] runtime failure callback received", {
          assistantMessageId: payload.assistantMessageId ?? null,
          conversationId: payload.conversationId,
          error: payload.error ?? null,
          tenantId,
        })

        const result = await dependencies.failAssistantMessage?.({
          assistantDisplayName: payload.assistantDisplayName,
          assistantMessageId: payload.assistantMessageId,
          conversationId: payload.conversationId,
          error: payload.error,
          tenantId,
        })

        if (!result) {
          console.warn(
            "[workspace-chat] runtime failure callback target missing",
            {
              assistantMessageId: payload.assistantMessageId ?? null,
              conversationId: payload.conversationId,
              tenantId,
            },
          )
          return jsonNoStore(
            {
              error:
                "Workspace chat conversation not found for this tenant runtime.",
            },
            404,
          )
        }

        console.info("[workspace-chat] runtime failure callback applied", {
          conversationId: result.conversationId,
          messageId: result.messageId,
          tenantId: result.tenantId,
        })

        return jsonNoStore(
          workspaceChatRuntimeMessageFailResponseSchema.parse({
            conversationId: result.conversationId,
            messageId: result.messageId,
            ok: true,
            tenantId: result.tenantId,
          }),
        )
      } catch (error) {
        return buildWorkspaceChatRuntimeErrorResponse(error)
      }
    },
  )

  app.post(
    "/api/internal/runtime/workspace-chat/messages/events",
    async (context) => {
      try {
        const { tenantId } = await (dependencies.authenticateTenantRuntime
          ? dependencies.authenticateTenantRuntime(context.req.raw)
          : authenticateTenantRuntimeRequest(context.req.raw))
        const payload =
          workspaceChatRuntimeMessageEventUpsertRequestSchema.parse(
            await context.req.json(),
          )

        console.info(
          "[workspace-chat] runtime activity event callback received",
          {
            assistantMessageId: payload.assistantMessageId,
            conversationId: payload.conversationId,
            eventType: payload.event.type,
            sequence: payload.event.sequence,
            tenantId,
          },
        )

        const result = await dependencies.applyAssistantEvent?.({
          assistantMessageId: payload.assistantMessageId,
          conversationId: payload.conversationId,
          event: payload.event,
          tenantId,
        })

        if (!result) {
          console.warn(
            "[workspace-chat] runtime activity event callback target missing",
            {
              assistantMessageId: payload.assistantMessageId,
              conversationId: payload.conversationId,
              sequence: payload.event.sequence,
              tenantId,
            },
          )
          return jsonNoStore(
            {
              error:
                "Workspace chat conversation not found for this tenant runtime.",
            },
            404,
          )
        }

        console.info(
          "[workspace-chat] runtime activity event callback applied",
          {
            conversationId: result.conversationId,
            eventId: result.eventId,
            messageId: result.messageId,
            tenantId: result.tenantId,
          },
        )

        return jsonNoStore(
          workspaceChatRuntimeMessageEventUpsertResponseSchema.parse({
            conversationId: result.conversationId,
            eventId: result.eventId,
            messageId: result.messageId,
            ok: true,
            tenantId: result.tenantId,
          }),
        )
      } catch (error) {
        return buildWorkspaceChatRuntimeErrorResponse(error)
      }
    },
  )

  return app
}

export function registerWorkspaceChatRuntimeRoutes(
  app: Hono,
  dependencies?: WorkspaceChatRuntimeRouteDependencies,
) {
  return app.route("/", createWorkspaceChatRuntimeRouter(dependencies))
}
