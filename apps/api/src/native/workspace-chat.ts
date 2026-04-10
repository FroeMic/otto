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
  WorkspaceChatNotImplementedError,
  type WorkspaceChatUser,
} from "@otto/feature-workspace-chat"
import type { Hono } from "hono"

import { syncUserFromSession } from "../workspace/data"

export type WorkspaceChatRouteDependencies = {
  authenticateWorkspaceUser: (request: Request) => Promise<WorkspaceChatUser>
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

function notImplemented<T>(message: string): Promise<T> {
  throw new WorkspaceChatNotImplementedError(message)
}

function createDefaultWorkspaceChatDependencies(): WorkspaceChatRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    createConversation: async () =>
      await notImplemented(
        "Workspace chat conversation persistence is not implemented in apps/api yet",
      ),
    createMessage: async () =>
      await notImplemented(
        "Workspace chat runtime dispatch is not implemented in apps/api yet",
      ),
    getConversationDetail: async () =>
      await notImplemented(
        "Workspace chat conversation detail loading is not implemented in apps/api yet",
      ),
    listConversations: async () =>
      await notImplemented(
        "Workspace chat conversation listing is not implemented in apps/api yet",
      ),
    syncUserFromSession:
      syncUserFromSession as WorkspaceChatRouteDependencies["syncUserFromSession"],
  }
}

export function registerWorkspaceChatRoutes(
  app: Hono,
  dependencies: WorkspaceChatRouteDependencies = createDefaultWorkspaceChatDependencies(),
) {
  async function authenticateUser(request: Request) {
    try {
      return {
        user: await dependencies.authenticateWorkspaceUser(request),
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

  app.get("/api/workspace/:orgSlug/chat/conversations", async (context) => {
    const authResult = await authenticateUser(context.req.raw)

    if ("response" in authResult) {
      return authResult.response
    }

    return handleWorkspaceChatConversationListRequest({
      listConversations: dependencies.listConversations,
      orgSlug: context.req.param("orgSlug"),
      syncUserFromSession: dependencies.syncUserFromSession,
      user: authResult.user,
    })
  })

  app.post("/api/workspace/:orgSlug/chat/conversations", async (context) => {
    const authResult = await authenticateUser(context.req.raw)

    if ("response" in authResult) {
      return authResult.response
    }

    return handleWorkspaceChatConversationCreateRequest({
      createConversation: dependencies.createConversation,
      orgSlug: context.req.param("orgSlug"),
      request: context.req.raw,
      syncUserFromSession: dependencies.syncUserFromSession,
      user: authResult.user,
    })
  })

  app.get(
    "/api/workspace/:orgSlug/chat/conversations/:conversationId",
    async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      return handleWorkspaceChatConversationDetailRequest({
        conversationId: context.req.param("conversationId"),
        getConversationDetail: dependencies.getConversationDetail,
        orgSlug: context.req.param("orgSlug"),
        syncUserFromSession: dependencies.syncUserFromSession,
        user: authResult.user,
      })
    },
  )

  app.post(
    "/api/workspace/:orgSlug/chat/conversations/:conversationId/messages",
    async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      return handleWorkspaceChatMessageCreateRequest({
        conversationId: context.req.param("conversationId"),
        createMessage: dependencies.createMessage,
        orgSlug: context.req.param("orgSlug"),
        request: context.req.raw,
        syncUserFromSession: dependencies.syncUserFromSession,
        user: authResult.user,
      })
    },
  )
}
