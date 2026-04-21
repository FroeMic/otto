import {
  type WorkspaceChatAttachment,
  type WorkspaceChatAttachmentUploadResponse,
  type WorkspaceChatConversationDetailResponse,
  type WorkspaceChatConversationListResponse,
  type WorkspaceChatConversationSummary,
  type WorkspaceChatMessageCreateResponse,
  type WorkspaceChatMessagePart,
  workspaceChatAttachmentUploadResponseSchema,
  workspaceChatConversationCreateRequestSchema,
  workspaceChatConversationCreateResponseSchema,
  workspaceChatConversationDetailResponseSchema,
  workspaceChatConversationListQuerySchema,
  workspaceChatConversationListResponseSchema,
  workspaceChatMessageCancelResponseSchema,
  workspaceChatMessageCreateRequestSchema,
  workspaceChatMessageCreateResponseSchema,
} from "@otto/feature-workspace-chat"
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function parseWorkspaceChatConversationList(
  data: unknown,
): WorkspaceChatConversationListResponse {
  return workspaceChatConversationListResponseSchema.parse(data)
}

export function parseWorkspaceChatConversationDetail(
  data: unknown,
): WorkspaceChatConversationDetailResponse {
  return workspaceChatConversationDetailResponseSchema.parse(data)
}

export function workspaceChatConversationListQueryOptions(orgSlug: string) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query = workspaceChatConversationListQuerySchema.parse({
        cursor: pageParam,
        limit: 30,
      })
      const response = await apiClient.api.workspace[
        ":orgSlug"
      ].chat.conversations.$get({
        param: {
          orgSlug,
        },
        query: {
          cursor: query.cursor,
          limit: query.limit ? String(query.limit) : undefined,
        },
      })

      return fetchApiResponse(response, parseWorkspaceChatConversationList)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    queryKey: ["workspace-chat-conversations", orgSlug],
    refetchInterval: 5_000,
    staleTime: 2_000,
  })
}

export function workspaceChatConversationDetailQueryOptions(
  orgSlug: string,
  conversationId: string,
) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[
        ":orgSlug"
      ].chat.conversations[":conversationId"].$get({
        param: {
          conversationId,
          orgSlug,
        },
      })

      return fetchApiResponse(response, parseWorkspaceChatConversationDetail)
    },
    queryKey: ["workspace-chat-conversation", orgSlug, conversationId],
    refetchInterval: 2_000,
    staleTime: 1_000,
  })
}

export async function createWorkspaceChatConversation(input: {
  orgSlug: string
  title?: string
}): Promise<WorkspaceChatConversationSummary> {
  const response = await apiClient.api.workspace[
    ":orgSlug"
  ].chat.conversations.$post({
    json: workspaceChatConversationCreateRequestSchema.parse({
      kind: "ad_hoc",
      title: input.title?.trim() || "New conversation",
      visibility: "open",
    }),
    param: {
      orgSlug: input.orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceChatConversationCreateResponseSchema.parse(data),
  ).then((data) => data.conversation)
}

export async function startAgentPersonalizationOnboarding(input: {
  orgSlug: string
}): Promise<WorkspaceChatConversationSummary> {
  const response = await apiClient.api.workspace[
    ":orgSlug"
  ].agent.personalization.onboarding.start.$post({
    param: {
      orgSlug: input.orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceChatConversationCreateResponseSchema.parse(data),
  ).then((data) => data.conversation)
}

export async function sendWorkspaceChatMessage(input: {
  clientMessageId?: string
  conversationId: string
  orgSlug: string
  parts: WorkspaceChatMessagePart[]
}) {
  const response = await apiClient.api.workspace[":orgSlug"].chat.conversations[
    ":conversationId"
  ].messages.$post({
    json: workspaceChatMessageCreateRequestSchema.parse({
      clientMessageId: input.clientMessageId,
      parts: input.parts,
    }),
    param: {
      conversationId: input.conversationId,
      orgSlug: input.orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceChatMessageCreateResponseSchema.parse(data),
  ) satisfies Promise<WorkspaceChatMessageCreateResponse>
}

export async function cancelWorkspaceChatAssistantMessage(input: {
  assistantMessageId: string
  conversationId: string
  orgSlug: string
}) {
  const response = await apiClient.api.workspace[":orgSlug"].chat.conversations[
    ":conversationId"
  ].messages[":assistantMessageId"].cancel.$post({
    param: {
      assistantMessageId: input.assistantMessageId,
      conversationId: input.conversationId,
      orgSlug: input.orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceChatMessageCancelResponseSchema.parse(data),
  )
}

export async function uploadWorkspaceChatAttachment(input: {
  file: File
  orgSlug: string
}): Promise<WorkspaceChatAttachment> {
  const formData = new FormData()
  formData.set("file", input.file)

  const response = await fetch(
    `/api/workspace/${encodeURIComponent(input.orgSlug)}/chat/attachments`,
    {
      body: formData,
      method: "POST",
    },
  )

  return fetchApiResponse(response, (data) =>
    workspaceChatAttachmentUploadResponseSchema.parse(data),
  ).then(
    (payload) =>
      payload.attachment satisfies WorkspaceChatAttachmentUploadResponse["attachment"],
  )
}

export function getWorkspaceChatAttachmentDownloadUrl(input: {
  attachmentId: string
  disposition?: "attachment" | "inline"
  orgSlug: string
}) {
  const query = new URLSearchParams()
  if (input.disposition) {
    query.set("disposition", input.disposition)
  }
  const querySuffix = query.toString().length > 0 ? `?${query.toString()}` : ""

  return `/api/workspace/${encodeURIComponent(input.orgSlug)}/chat/attachments/${encodeURIComponent(input.attachmentId)}/download${querySuffix}`
}

export async function transcribeWorkspaceChatAttachment(input: {
  attachmentId: string
  orgSlug: string
}) {
  const response = await fetch(
    `/api/workspace/${encodeURIComponent(input.orgSlug)}/chat/attachments/${encodeURIComponent(input.attachmentId)}/transcription`,
    {
      method: "POST",
    },
  )

  return fetchApiResponse(response, (data) => {
    const parsed = data as { transcript?: unknown }
    return {
      transcript:
        typeof parsed.transcript === "string" ? parsed.transcript : null,
    } as const
  }).then((payload) => payload.transcript)
}
