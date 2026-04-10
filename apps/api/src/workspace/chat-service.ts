import type {
  WorkspaceChatMessageCreateRequest,
  WorkspaceChatMessageCreateResponse,
} from "@otto/feature-workspace-chat"

import { createWorkspaceChatMessageRecord } from "./chat-data"
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
      tenantId: string
    }
  >
  dispatchMessage?: (input: {
    conversationId: string
    message: string
    tenantId: string
  }) => Promise<{
    status: "sent"
  }>
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
  const created = await createMessageRecord(input)

  try {
    const dispatchResult = await dispatchMessage({
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
