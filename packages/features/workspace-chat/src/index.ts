import { jsonNoStore } from "@otto/auth"
import * as z from "zod"

import {
  type WorkspaceChatConversationCreateRequest,
  type WorkspaceChatConversationDetailResponse,
  type WorkspaceChatConversationSummary,
  type WorkspaceChatMessageCreateRequest,
  type WorkspaceChatMessageCreateResponse,
  workspaceChatConversationCreateRequestSchema,
  workspaceChatConversationCreateResponseSchema,
  workspaceChatConversationDetailResponseSchema,
  workspaceChatConversationListResponseSchema,
  workspaceChatMessageCreateRequestSchema,
  workspaceChatMessageCreateResponseSchema,
} from "./schemas"

export type WorkspaceChatUser = {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export class WorkspaceChatNotImplementedError extends Error {
  constructor(message = "Workspace chat is not implemented yet") {
    super(message)
    this.name = "WorkspaceChatNotImplementedError"
  }
}

function buildWorkspaceChatErrorResponse(error: unknown) {
  if (error instanceof WorkspaceChatNotImplementedError) {
    return jsonNoStore(
      {
        error: error.message,
      },
      501,
    )
  }

  if (error instanceof z.ZodError) {
    return jsonNoStore(
      {
        error: "Invalid workspace chat payload",
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
      error: "Workspace chat request failed",
    },
    500,
  )
}

function buildUserName(user: WorkspaceChatUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
}

export async function handleWorkspaceChatConversationListRequest<
  TUser extends WorkspaceChatUser,
>(input: {
  listConversations: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceChatConversationSummary[]>
  orgSlug: string
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)

    const conversations = await input.listConversations({
      orgSlug: input.orgSlug,
      userExternalId: input.user.id,
    })

    return jsonNoStore(
      workspaceChatConversationListResponseSchema.parse({
        conversations,
      }),
    )
  } catch (error) {
    return buildWorkspaceChatErrorResponse(error)
  }
}

export async function handleWorkspaceChatConversationCreateRequest<
  TUser extends WorkspaceChatUser,
>(input: {
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
  orgSlug: string
  request: Request
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)

    const conversation = workspaceChatConversationCreateRequestSchema.parse(
      await input.request.json(),
    )
    const result = await input.createConversation({
      kind: conversation.kind,
      orgSlug: input.orgSlug,
      slug: conversation.slug,
      title: conversation.title,
      userExternalId: input.user.id,
      visibility: conversation.visibility,
    })

    return jsonNoStore(
      workspaceChatConversationCreateResponseSchema.parse({
        conversation: result.createdConversation,
      }),
      201,
    )
  } catch (error) {
    return buildWorkspaceChatErrorResponse(error)
  }
}

export async function handleWorkspaceChatConversationDetailRequest<
  TUser extends WorkspaceChatUser,
>(input: {
  conversationId: string
  getConversationDetail: (payload: {
    conversationId: string
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceChatConversationDetailResponse | null>
  orgSlug: string
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)

    const detail = await input.getConversationDetail({
      conversationId: input.conversationId,
      orgSlug: input.orgSlug,
      userExternalId: input.user.id,
    })

    if (!detail) {
      return jsonNoStore(
        {
          error: "Conversation not found",
        },
        404,
      )
    }

    return jsonNoStore(
      workspaceChatConversationDetailResponseSchema.parse(detail),
    )
  } catch (error) {
    return buildWorkspaceChatErrorResponse(error)
  }
}

export async function handleWorkspaceChatMessageCreateRequest<
  TUser extends WorkspaceChatUser,
>(input: {
  conversationId: string
  createMessage: (payload: {
    clientMessageId?: string
    conversationId: string
    orgSlug: string
    parts: WorkspaceChatMessageCreateRequest["parts"]
    userDisplayName: string
    userExternalId: string
  }) => Promise<WorkspaceChatMessageCreateResponse>
  orgSlug: string
  request: Request
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)

    const message = workspaceChatMessageCreateRequestSchema.parse(
      await input.request.json(),
    )
    const result = await input.createMessage({
      clientMessageId: message.clientMessageId,
      conversationId: input.conversationId,
      orgSlug: input.orgSlug,
      parts: message.parts,
      userDisplayName: buildUserName(input.user),
      userExternalId: input.user.id,
    })

    return jsonNoStore(
      workspaceChatMessageCreateResponseSchema.parse(result),
      202,
    )
  } catch (error) {
    return buildWorkspaceChatErrorResponse(error)
  }
}

export type {
  WorkspaceChatConversationCreateRequest,
  WorkspaceChatConversationDetailResponse,
  WorkspaceChatConversationSummary,
  WorkspaceChatMessage,
  WorkspaceChatMessageCreateRequest,
  WorkspaceChatMessageCreateResponse,
  WorkspaceChatMessagePart,
  WorkspaceChatRuntimeMessageCompleteRequest,
  WorkspaceChatRuntimeMessageCompleteResponse,
} from "./schemas"
export {
  workspaceChatConversationCreateRequestSchema,
  workspaceChatConversationCreateResponseSchema,
  workspaceChatConversationDetailResponseSchema,
  workspaceChatConversationKindSchema,
  workspaceChatConversationListResponseSchema,
  workspaceChatConversationSummarySchema,
  workspaceChatConversationVisibilitySchema,
  workspaceChatMessageCreateRequestSchema,
  workspaceChatMessageCreateResponseSchema,
  workspaceChatMessagePartSchema,
  workspaceChatMessageSchema,
  workspaceChatRuntimeMessageCompleteRequestSchema,
  workspaceChatRuntimeMessageCompleteResponseSchema,
  workspaceChatRuntimeSessionStatusSchema,
} from "./schemas"
