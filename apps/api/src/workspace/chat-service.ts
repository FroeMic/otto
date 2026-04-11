import type {
  WorkspaceChatMessageCreateRequest,
  WorkspaceChatMessageCreateResponse,
} from "@otto/feature-workspace-chat"

import {
  createWorkspaceChatMessageRecord,
  markWorkspaceChatAssistantMessageFailed,
} from "./chat-data"
import { dispatchWorkspaceChatMessage } from "./chat-dispatch"

type CreateAndDispatchWorkspaceChatMessageDependencies = {
  createMessageRecord?: (input: {
    clientMessageId?: string
    conversationId: string
    orgSlug: string
    parts: WorkspaceChatMessageCreateRequest["parts"]
    userDisplayName: string
    userExternalId: string
  }) => Promise<
    WorkspaceChatMessageCreateResponse & {
      assistantMessageId?: string
      shouldDispatch: boolean
      tenantId: string
    }
  >
  dispatchMessage?: (input: {
    assistantMessageId?: string
    conversationId: string
    message: string
    tenantId: string
  }) => Promise<{
    status: "queued"
  }>
  markAssistantMessageFailed?: (input: {
    assistantMessageId: string
    conversationId: string
  }) => Promise<void>
}

export async function createAndDispatchWorkspaceChatMessage(input: {
  clientMessageId?: string
  conversationId: string
  orgSlug: string
  parts: WorkspaceChatMessageCreateRequest["parts"]
  userDisplayName: string
  userExternalId: string
}, dependencies: CreateAndDispatchWorkspaceChatMessageDependencies = {}) {
  const createMessageRecord =
    dependencies.createMessageRecord ?? createWorkspaceChatMessageRecord
  const dispatchMessage =
    dependencies.dispatchMessage ?? dispatchWorkspaceChatMessage
  const markAssistantMessageFailed =
    dependencies.markAssistantMessageFailed ??
    markWorkspaceChatAssistantMessageFailed
  const created = await createMessageRecord(input)

  if (!created.shouldDispatch) {
    return {
      conversationId: created.conversationId,
      dispatch: created.dispatch,
      message: created.message,
    } satisfies WorkspaceChatMessageCreateResponse
  }

  try {
    const dispatchResult = await dispatchMessage({
      assistantMessageId: created.assistantMessageId,
      conversationId: created.conversationId,
      message: flattenWorkspaceChatPartsToPrompt(created.message.parts),
      tenantId: created.tenantId,
    })

    return {
      conversationId: created.conversationId,
      dispatch: dispatchResult,
      message: created.message,
    } satisfies WorkspaceChatMessageCreateResponse
  } catch (error) {
    console.error(
      "[workspace-chat] runtime dispatch failed",
      error instanceof Error ? error.message : error,
    )

    if (created.assistantMessageId) {
      await markAssistantMessageFailed({
        assistantMessageId: created.assistantMessageId,
        conversationId: created.conversationId,
      })
    }

    return {
      conversationId: created.conversationId,
      dispatch: {
        status: "pending_runtime_bridge",
      },
      message: created.message,
    } satisfies WorkspaceChatMessageCreateResponse
  }
}

function flattenWorkspaceChatPartsToPrompt(
  parts: WorkspaceChatMessageCreateRequest["parts"],
) {
  const segments = parts.flatMap((part) => {
    if (part.type === "text") {
      return [part.text.trim()]
    }

    if (part.type === "file") {
      return [`[File: ${part.fileName}]`]
    }

    if (part.type === "audio") {
      return [part.transcript?.trim() || "[Voice note]"]
    }

    return []
  })

  const prompt = segments.filter(Boolean).join("\n\n").trim()

  if (!prompt) {
    throw new Error("Workspace chat dispatch requires at least one promptable part.")
  }

  return prompt
}
