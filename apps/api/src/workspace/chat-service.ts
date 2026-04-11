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
    senderDisplayName: string
    senderExternalId: string
    tenantId: string
    userMessageId: string
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

  console.info("[workspace-chat] message record created", {
    assistantMessageId: created.assistantMessageId ?? null,
    conversationId: created.conversationId,
    dispatchStatus: created.dispatch.status,
    shouldDispatch: created.shouldDispatch,
    tenantId: created.tenantId,
    userMessageId: created.message.id,
  })

  if (!created.shouldDispatch) {
    return {
      conversationId: created.conversationId,
      dispatch: created.dispatch,
      message: created.message,
    } satisfies WorkspaceChatMessageCreateResponse
  }

  try {
    const prompt = flattenWorkspaceChatPartsToPrompt(created.message.parts)

    console.info("[workspace-chat] dispatching runtime turn", {
      assistantMessageId: created.assistantMessageId ?? null,
      conversationId: created.conversationId,
      promptLength: prompt.length,
      tenantId: created.tenantId,
    })

    const dispatchResult = await dispatchMessage({
      ...(created.assistantMessageId
        ? { assistantMessageId: created.assistantMessageId }
        : {}),
      conversationId: created.conversationId,
      message: prompt,
      senderDisplayName: input.userDisplayName,
      senderExternalId: input.userExternalId,
      tenantId: created.tenantId,
      userMessageId: created.message.id,
    })

    console.info("[workspace-chat] runtime turn queued", {
      assistantMessageId: created.assistantMessageId ?? null,
      conversationId: created.conversationId,
      queueStatus: dispatchResult.status,
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
      {
        assistantMessageId: created.assistantMessageId ?? null,
        conversationId: created.conversationId,
        error: error instanceof Error ? error.message : error,
        tenantId: created.tenantId,
      },
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
