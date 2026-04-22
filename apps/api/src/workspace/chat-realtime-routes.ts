import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import type {
  WorkspaceChatRealtimeClientMessage,
  WorkspaceChatRealtimeServerEvent,
  WorkspaceChatUser,
} from "@otto/feature-workspace-chat"
import { workspaceChatRealtimeClientMessageSchema } from "@otto/feature-workspace-chat"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"
import { canAccessWorkspaceChatConversation } from "./chat-data"
import { getWorkspaceChatRealtimeHub } from "./chat-realtime-hub"
import { syncUserFromSession } from "./data"

const workspaceRealtimeParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

export type WorkspaceChatRealtimeRouteDependencies = {
  authenticateWorkspaceUser?: (request: Request) => Promise<WorkspaceChatUser>
  canAccessConversation: (payload: {
    conversationId: string
    orgSlug: string
    userExternalId: string
  }) => Promise<boolean>
  realtimeHub?: ReturnType<typeof getWorkspaceChatRealtimeHub>
  syncUserFromSession: (user: WorkspaceChatUser) => Promise<unknown>
}

function createDefaultWorkspaceChatRealtimeRouteDependencies(): WorkspaceChatRealtimeRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    canAccessConversation: canAccessWorkspaceChatConversation,
    realtimeHub: getWorkspaceChatRealtimeHub(),
    syncUserFromSession:
      syncUserFromSession as WorkspaceChatRealtimeRouteDependencies["syncUserFromSession"],
  }
}

export function createWorkspaceChatRealtimeRouter(
  dependencies: WorkspaceChatRealtimeRouteDependencies = createDefaultWorkspaceChatRealtimeRouteDependencies(),
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

  const realtimeHub = dependencies.realtimeHub ?? getWorkspaceChatRealtimeHub()

  return new Hono().get(
    "/api/workspace/:orgSlug/chat/realtime",
    zValidator("param", workspaceRealtimeParamsSchema),
    async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      await dependencies.syncUserFromSession(authResult.user)

      const { orgSlug } = context.req.valid("param")
      const connectionId = crypto.randomUUID()

      return upgradeWorkspaceChatWebSocket(context, {
        onClose() {
          realtimeHub.unregisterConnection(connectionId)
        },
        onMessage(event, ws) {
          void handleWorkspaceChatRealtimeClientMessage({
            connectionId,
            dependencies,
            message:
              typeof event.data === "string"
                ? event.data
                : Buffer.from(event.data as ArrayBuffer).toString("utf8"),
            orgSlug,
            realtimeHub,
            send(eventPayload) {
              ws.send(JSON.stringify(eventPayload))
            },
            user: authResult.user,
          })
        },
        onOpen(_, ws) {
          realtimeHub.registerConnection({
            connectionId,
            send(eventPayload) {
              ws.send(JSON.stringify(eventPayload))
            },
          })
        },
      })
    },
  )
}

type WorkspaceChatWebSocketEvents = {
  onClose?: (event: CloseEvent, ws: WorkspaceChatWebSocketContext) => void
  onMessage?: (event: MessageEvent, ws: WorkspaceChatWebSocketContext) => void
  onOpen?: (event: Event, ws: WorkspaceChatWebSocketContext) => void
}

type WorkspaceChatWebSocketContext = {
  close: (code?: number, reason?: string) => void
  send: (data: string) => void
}

async function upgradeWorkspaceChatWebSocket(
  context: Context,
  events: WorkspaceChatWebSocketEvents,
) {
  const envUpgrade = (
    context.env as
      | {
          upgrade?: (
            request: Request,
            options: {
              data: {
                events: WorkspaceChatWebSocketEvents
                protocol: string
                url: URL
              }
            },
          ) => boolean
        }
      | undefined
  )?.upgrade

  if (envUpgrade) {
    return envUpgrade.call(context.env, context.req.raw, {
      data: {
        events,
        protocol: context.req.url,
        url: new URL(context.req.url),
      },
    })
      ? new Response(null)
      : new Response(null, { status: 426 })
  }

  const { upgradeWebSocket } = await import("hono/bun")
  return upgradeWebSocket(context, events)
}

async function handleWorkspaceChatRealtimeClientMessage(input: {
  connectionId: string
  dependencies: WorkspaceChatRealtimeRouteDependencies
  message: string
  orgSlug: string
  realtimeHub: ReturnType<typeof getWorkspaceChatRealtimeHub>
  send: (event: WorkspaceChatRealtimeServerEvent) => void
  user: WorkspaceChatUser
}) {
  let clientMessage: WorkspaceChatRealtimeClientMessage

  try {
    clientMessage = workspaceChatRealtimeClientMessageSchema.parse(
      JSON.parse(input.message),
    )
  } catch {
    return
  }

  if (clientMessage.type === "ping") {
    input.send({
      type: "pong",
    })
    return
  }

  if (clientMessage.type === "unsubscribe") {
    input.realtimeHub.unsubscribeConnection(
      input.connectionId,
      clientMessage.conversationId,
    )
    input.send({
      conversationId: clientMessage.conversationId,
      type: "unsubscribed",
    })
    return
  }

  const canAccessConversation = await input.dependencies.canAccessConversation({
    conversationId: clientMessage.conversationId,
    orgSlug: input.orgSlug,
    userExternalId: input.user.id,
  })

  if (!canAccessConversation) {
    input.send({
      conversationId: clientMessage.conversationId,
      type: "subscription_denied",
    })
    return
  }

  input.realtimeHub.subscribeConnection(
    input.connectionId,
    clientMessage.conversationId,
  )
  input.send({
    conversationId: clientMessage.conversationId,
    type: "subscribed",
  })
}
