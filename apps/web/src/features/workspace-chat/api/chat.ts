import {
  type WorkspaceChatConversationDetailResponse,
  type WorkspaceChatConversationSummary,
  type WorkspaceChatMessageCreateResponse,
  workspaceChatConversationCreateRequestSchema,
  workspaceChatConversationCreateResponseSchema,
  workspaceChatConversationDetailResponseSchema,
  workspaceChatConversationListResponseSchema,
  workspaceChatMessageCreateRequestSchema,
  workspaceChatMessageCreateResponseSchema,
} from "@otto/feature-workspace-chat"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function parseWorkspaceChatConversationList(
  data: unknown,
): WorkspaceChatConversationSummary[] {
  return workspaceChatConversationListResponseSchema.parse(data).conversations
}

export function parseWorkspaceChatConversationDetail(
  data: unknown,
): WorkspaceChatConversationDetailResponse {
  return workspaceChatConversationDetailResponseSchema.parse(data)
}

export function workspaceChatConversationListQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"].chat.conversations.$get({
          param: {
            orgSlug,
          },
        })

      return fetchApiResponse(response, parseWorkspaceChatConversationList)
    },
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
      const response =
        await apiClient.api.workspace[":orgSlug"].chat.conversations[
          ":conversationId"
        ].$get({
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
  const response =
    await apiClient.api.workspace[":orgSlug"].chat.conversations.$post({
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

export async function sendWorkspaceChatMessage(input: {
  clientMessageId?: string
  conversationId: string
  orgSlug: string
  text: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].chat.conversations[
      ":conversationId"
    ].messages.$post({
      json: workspaceChatMessageCreateRequestSchema.parse({
        clientMessageId: input.clientMessageId,
        parts: [
          {
            text: input.text,
            type: "text",
          },
        ],
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
