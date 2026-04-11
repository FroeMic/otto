import { jsonNoStore } from "@otto/auth"
import {
  type WorkspaceChatRuntimeMessageCompleteRequest,
  type WorkspaceChatRuntimeMessageDeltaRequest,
  type WorkspaceChatRuntimeMessageFailRequest,
  workspaceChatRuntimeMessageCompleteRequestSchema,
  workspaceChatRuntimeMessageCompleteResponseSchema,
  workspaceChatRuntimeMessageDeltaRequestSchema,
  workspaceChatRuntimeMessageDeltaResponseSchema,
  workspaceChatRuntimeMessageFailRequestSchema,
  workspaceChatRuntimeMessageFailResponseSchema,
} from "@otto/feature-workspace-chat"
import { Hono } from "hono"
import * as z from "zod"
import {
  applyWorkspaceChatAssistantDelta,
  completeWorkspaceChatAssistantMessage,
  markWorkspaceChatAssistantMessageFailed,
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

  app.post("/api/internal/runtime/workspace-chat/messages/delta", async (context) => {
    try {
      const { tenantId } = await (dependencies.authenticateTenantRuntime
        ? dependencies.authenticateTenantRuntime(context.req.raw)
        : authenticateTenantRuntimeRequest(context.req.raw))
      const payload = workspaceChatRuntimeMessageDeltaRequestSchema.parse(
        await context.req.json(),
      )
      const result = await dependencies.applyAssistantDelta({
        assistantDisplayName: payload.assistantDisplayName,
        assistantMessageId: payload.assistantMessageId,
        conversationId: payload.conversationId,
        sequence: payload.sequence,
        tenantId,
        text: payload.message.text,
      })

      if (!result) {
        return jsonNoStore(
          {
            error:
              "Workspace chat conversation not found for this tenant runtime.",
          },
          404,
        )
      }

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
  })

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
        const result = await dependencies.completeAssistantMessage({
          assistantMessageId: payload.assistantMessageId,
          assistantDisplayName: payload.assistantDisplayName,
          conversationId: payload.conversationId,
          parts: payload.message.parts,
          session: payload.session,
          tenantId,
        })

        if (!result) {
          return jsonNoStore(
            {
              error:
                "Workspace chat conversation not found for this tenant runtime.",
            },
            404,
          )
        }

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

  app.post("/api/internal/runtime/workspace-chat/messages/fail", async (context) => {
    try {
      const { tenantId } = await (dependencies.authenticateTenantRuntime
        ? dependencies.authenticateTenantRuntime(context.req.raw)
        : authenticateTenantRuntimeRequest(context.req.raw))
      const payload = workspaceChatRuntimeMessageFailRequestSchema.parse(
        await context.req.json(),
      )
      const result = await dependencies.failAssistantMessage?.({
        assistantDisplayName: payload.assistantDisplayName,
        assistantMessageId: payload.assistantMessageId,
        conversationId: payload.conversationId,
        error: payload.error,
        tenantId,
      })

      if (!result) {
        return jsonNoStore(
          {
            error:
              "Workspace chat conversation not found for this tenant runtime.",
          },
          404,
        )
      }

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
  })

  return app
}

export function registerWorkspaceChatRuntimeRoutes(
  app: Hono,
  dependencies?: WorkspaceChatRuntimeRouteDependencies,
) {
  return app.route("/", createWorkspaceChatRuntimeRouter(dependencies))
}
