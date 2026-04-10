import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  handleWorkspaceChatConversationCreateRequest,
  handleWorkspaceChatConversationDetailRequest,
  handleWorkspaceChatConversationListRequest,
  handleWorkspaceChatMessageCreateRequest,
  type WorkspaceChatConversationCreateRequest,
  type WorkspaceChatConversationDetailResponse,
  type WorkspaceChatConversationSummary,
  type WorkspaceChatMessageCreateRequest,
  type WorkspaceChatMessageCreateResponse,
  type WorkspaceChatUser,
} from "@otto/feature-workspace-chat"
import { Hono } from "hono"
import { z } from "zod"

import {
  createWorkspaceChatConversation,
  getWorkspaceChatConversationDetail,
  listWorkspaceChatConversations,
} from "./chat-data"
import { createAndDispatchWorkspaceChatMessage } from "./chat-service"
import { syncUserFromSession } from "./data"

const workspaceParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceConversationParamsSchema = workspaceParamsSchema.extend({
  conversationId: z.string().min(1),
})

export type WorkspaceChatRouteDependencies = {
  authenticateWorkspaceUser?: (request: Request) => Promise<WorkspaceChatUser>
  createConversation: (payload: {
    kind: WorkspaceChatConversationCreateRequest["kind"]
    orgSlug: string
    slug?: string
    title: string
    userExternalId: string
    visibility: WorkspaceChatConversationCreateRequest["visibility"]
  }) => Promise<{
    createdConversation: WorkspaceChatConversationSummary
  }>
  createMessage: (payload: {
    clientMessageId?: string
    conversationId: string
    orgSlug: string
    parts: WorkspaceChatMessageCreateRequest["parts"]
    userDisplayName: string
    userExternalId: string
  }) => Promise<WorkspaceChatMessageCreateResponse>
  getConversationDetail: (payload: {
    conversationId: string
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceChatConversationDetailResponse | null>
  listConversations: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceChatConversationSummary[]>
  syncUserFromSession: (user: WorkspaceChatUser) => Promise<unknown>
}

function createDefaultWorkspaceChatRouteDependencies(): WorkspaceChatRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    createConversation: createWorkspaceChatConversation,
    createMessage: createAndDispatchWorkspaceChatMessage,
    getConversationDetail: getWorkspaceChatConversationDetail,
    listConversations: listWorkspaceChatConversations,
    syncUserFromSession:
      syncUserFromSession as WorkspaceChatRouteDependencies["syncUserFromSession"],
  }
}

export function createWorkspaceChatRouter(
  dependencies: WorkspaceChatRouteDependencies = createDefaultWorkspaceChatRouteDependencies(),
) {
  async function authenticateUser(request: Request) {
    try {
      return {
        user: await (dependencies.authenticateWorkspaceUser
          ? dependencies.authenticateWorkspaceUser(request)
          : authenticateWorkspaceSessionRequest({ request })),
      } as const
    } catch (error) {
      if (isWorkspaceSessionAuthError(error)) {
        return {
          response: jsonNoStore(
            {
              code: error.code,
              message: error.message,
            },
            error.status,
          ),
        } as const
      }

      throw error
    }
  }

  return new Hono()
    .get(
      "/api/workspace/:orgSlug/chat/conversations",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        return handleWorkspaceChatConversationListRequest({
          listConversations: dependencies.listConversations,
          orgSlug: context.req.valid("param").orgSlug,
          syncUserFromSession: dependencies.syncUserFromSession,
          user: authResult.user,
        })
      },
    )
    .post(
      "/api/workspace/:orgSlug/chat/conversations",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        return handleWorkspaceChatConversationCreateRequest({
          createConversation: dependencies.createConversation,
          orgSlug: context.req.valid("param").orgSlug,
          request: context.req.raw,
          syncUserFromSession: dependencies.syncUserFromSession,
          user: authResult.user,
        })
      },
    )
    .get(
      "/api/workspace/:orgSlug/chat/conversations/:conversationId",
      zValidator("param", workspaceConversationParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { conversationId, orgSlug } = context.req.valid("param")

        return handleWorkspaceChatConversationDetailRequest({
          conversationId,
          getConversationDetail: dependencies.getConversationDetail,
          orgSlug,
          syncUserFromSession: dependencies.syncUserFromSession,
          user: authResult.user,
        })
      },
    )
    .post(
      "/api/workspace/:orgSlug/chat/conversations/:conversationId/messages",
      zValidator("param", workspaceConversationParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { conversationId, orgSlug } = context.req.valid("param")

        return handleWorkspaceChatMessageCreateRequest({
          conversationId,
          createMessage: dependencies.createMessage,
          orgSlug,
          request: context.req.raw,
          syncUserFromSession: dependencies.syncUserFromSession,
          user: authResult.user,
        })
      },
    )
}
