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
  type WorkspaceChatAttachmentUploadResponse,
  type WorkspaceChatConversationCreateRequest,
  type WorkspaceChatConversationDetailResponse,
  type WorkspaceChatConversationListQuery,
  type WorkspaceChatConversationListResponse,
  type WorkspaceChatConversationSummary,
  type WorkspaceChatMessageCreateRequest,
  type WorkspaceChatMessageCreateResponse,
  type WorkspaceChatUser,
  workspaceChatAttachmentUploadResponseSchema,
  workspaceChatConversationCreateRequestSchema,
  workspaceChatConversationListQuerySchema,
  workspaceChatMessageCreateRequestSchema,
} from "@otto/feature-workspace-chat"
import { Hono } from "hono"
import { z } from "zod"

import {
  createWorkspaceChatConversation,
  getWorkspaceChatConversationDetail,
  listWorkspaceChatConversations,
} from "./chat-data"
import {
  createWorkspaceChatAttachment,
  getWorkspaceChatAttachmentContentForUser,
  transcribeWorkspaceChatAttachmentForUser,
} from "./chat-attachments-service"
import { createWorkspaceChatRealtimeRouter } from "./chat-realtime-routes"
import { createAndDispatchWorkspaceChatMessage } from "./chat-service"
import { syncUserFromSession } from "./data"

const workspaceParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceConversationParamsSchema = workspaceParamsSchema.extend({
  conversationId: z.string().min(1),
})

const workspaceAttachmentParamsSchema = workspaceParamsSchema.extend({
  attachmentId: z.string().min(1),
})
const workspaceAttachmentDownloadQuerySchema = z.object({
  disposition: z.enum(["attachment", "inline"]).optional(),
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
  createAttachment: (payload: {
    file: File
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceChatAttachmentUploadResponse["attachment"]>
  transcribeAttachment: (payload: {
    attachmentId: string
    orgSlug: string
    userExternalId: string
  }) => Promise<string | null>
  getAttachmentDownload: (payload: {
    attachmentId: string
    orgSlug: string
    userExternalId: string
  }) => Promise<{ bytes: Uint8Array; fileName: string; mimeType: string } | null>
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
    cursor?: WorkspaceChatConversationListQuery["cursor"]
    limit?: WorkspaceChatConversationListQuery["limit"]
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceChatConversationListResponse>
  syncUserFromSession: (user: WorkspaceChatUser) => Promise<unknown>
}

function createDefaultWorkspaceChatRouteDependencies(): WorkspaceChatRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    createAttachment: createWorkspaceChatAttachment,
    transcribeAttachment: transcribeWorkspaceChatAttachmentForUser,
    getAttachmentDownload: async (payload) => {
      const result = await getWorkspaceChatAttachmentContentForUser(payload)

      if (!result) {
        return null
      }

      return {
        bytes: result.bytes,
        fileName: result.attachment.fileName,
        mimeType: result.attachment.mimeType,
      }
    },
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
    .route(
      "/",
      createWorkspaceChatRealtimeRouter({
        authenticateWorkspaceUser: dependencies.authenticateWorkspaceUser,
        canAccessConversation: async (payload) =>
          Boolean(await dependencies.getConversationDetail(payload)),
        syncUserFromSession: dependencies.syncUserFromSession,
      }),
    )
    .get(
      "/api/workspace/:orgSlug/chat/conversations",
      zValidator("param", workspaceParamsSchema),
      zValidator("query", workspaceChatConversationListQuerySchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        return handleWorkspaceChatConversationListRequest({
          listConversations: dependencies.listConversations,
          orgSlug: context.req.valid("param").orgSlug,
          query: context.req.valid("query"),
          syncUserFromSession: dependencies.syncUserFromSession,
          user: authResult.user,
        })
      },
    )
    .post(
      "/api/workspace/:orgSlug/chat/conversations",
      zValidator("param", workspaceParamsSchema),
      zValidator("json", workspaceChatConversationCreateRequestSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        return handleWorkspaceChatConversationCreateRequest({
          body: context.req.valid("json"),
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
      "/api/workspace/:orgSlug/chat/attachments",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        await dependencies.syncUserFromSession(authResult.user)

        try {
          const formData = await context.req.raw.formData()
          const fileValue = formData.get("file")

          if (!isWorkspaceChatUploadFile(fileValue)) {
            return jsonNoStore(
              {
                error: "Workspace chat attachment file is required.",
              },
              400,
            )
          }

          const attachment = await dependencies.createAttachment({
            file: fileValue,
            orgSlug: context.req.valid("param").orgSlug,
            userExternalId: authResult.user.id,
          })

          return jsonNoStore(
            workspaceChatAttachmentUploadResponseSchema.parse({
              attachment,
            }),
            201,
          )
        } catch (error) {
          if (error instanceof Error) {
            return jsonNoStore(
              {
                error: error.message,
              },
              400,
            )
          }

          throw error
        }
      },
    )
    .get(
      "/api/workspace/:orgSlug/chat/attachments/:attachmentId/download",
      zValidator("param", workspaceAttachmentParamsSchema),
      zValidator("query", workspaceAttachmentDownloadQuerySchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        try {
          const { attachmentId, orgSlug } = context.req.valid("param")
          const query = context.req.valid("query")
          const download = await dependencies.getAttachmentDownload({
            attachmentId,
            orgSlug,
            userExternalId: authResult.user.id,
          })

          if (!download) {
            return jsonNoStore(
              {
                error: "Workspace chat attachment not found.",
              },
              404,
            )
          }

          const body = new Uint8Array(download.bytes)

          return new Response(body, {
            headers: {
              "Cache-Control": "no-store",
              "Content-Disposition": `${query.disposition === "inline" ? "inline" : "attachment"}; filename=\"${sanitizeDownloadFileName(download.fileName)}\"`,
              "Content-Length": String(download.bytes.byteLength),
              "Content-Type": download.mimeType,
            },
            status: 200,
          })
        } catch (error) {
          return jsonNoStore(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to download workspace chat attachment.",
            },
            500,
          )
        }
      },
    )
    .post(
      "/api/workspace/:orgSlug/chat/attachments/:attachmentId/transcription",
      zValidator("param", workspaceAttachmentParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        try {
          const { attachmentId, orgSlug } = context.req.valid("param")
          const transcript = await dependencies.transcribeAttachment({
            attachmentId,
            orgSlug,
            userExternalId: authResult.user.id,
          })

          return jsonNoStore({
            transcript,
          })
        } catch (error) {
          return jsonNoStore(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to transcribe workspace chat attachment.",
            },
            500,
          )
        }
      },
    )
    .post(
      "/api/workspace/:orgSlug/chat/conversations/:conversationId/messages",
      zValidator("param", workspaceConversationParamsSchema),
      zValidator("json", workspaceChatMessageCreateRequestSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { conversationId, orgSlug } = context.req.valid("param")

        console.info("[workspace-chat] message create request received", {
          conversationId,
          orgSlug,
          userId: authResult.user.id,
        })

        return handleWorkspaceChatMessageCreateRequest({
          body: context.req.valid("json"),
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

function sanitizeDownloadFileName(value: string) {
  return value.replace(/["\\\r\n]/g, "_")
}

function isWorkspaceChatUploadFile(value: unknown): value is File {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).name === "string"
  )
}
