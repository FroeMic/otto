import { jsonNoStore } from "@otto/auth"
import {
  type WorkspaceChatRuntimeMessageCompleteRequest,
  workspaceChatRuntimeMessageCompleteRequestSchema,
  workspaceChatRuntimeMessageCompleteResponseSchema,
} from "@otto/feature-workspace-chat"
import { Hono } from "hono"
import * as z from "zod"
import { completeWorkspaceChatAssistantMessage } from "../workspace/chat-data"

import { authenticateTenantRuntimeRequest } from "./auth"

export type WorkspaceChatRuntimeRouteDependencies = {
  authenticateTenantRuntime?: (request: Request) => Promise<{
    tenantId: string
  }>
  completeAssistantMessage: (payload: {
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
}

function createDefaultWorkspaceChatRuntimeRouteDependencies(): WorkspaceChatRuntimeRouteDependencies {
  return {
    authenticateTenantRuntime: authenticateTenantRuntimeRequest,
    completeAssistantMessage: completeWorkspaceChatAssistantMessage,
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

  return app
}

export function registerWorkspaceChatRuntimeRoutes(
  app: Hono,
  dependencies?: WorkspaceChatRuntimeRouteDependencies,
) {
  return app.route("/", createWorkspaceChatRuntimeRouter(dependencies))
}
