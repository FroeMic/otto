import type {
  WorkspaceChatMessageCreateRequest,
  WorkspaceChatMessageCreateResponse,
  WorkspaceChatMessagePart,
} from "@otto/feature-workspace-chat"
import { validateWorkspaceChatAttachmentOwnership } from "./chat-attachments-service"
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
      conversationKind: "ad_hoc" | "durable_named" | "external_surface"
      conversationTitle: string
      conversationVisibility: "open" | "personal"
      shouldDispatch: boolean
      tenantId: string
    }
  >
  dispatchMessage?: (input: {
    assistantMessageId?: string
    conversationKind: "ad_hoc" | "durable_named" | "external_surface"
    conversationId: string
    conversationTitle: string
    conversationVisibility: "open" | "personal"
    parts: WorkspaceChatMessagePart[]
    senderDisplayName: string
    senderExternalId: string
    tenantId: string
    userMessageId: string
  }) => Promise<{
    status: "queued"
  }>
  validateAttachmentOwnership?: (input: {
    attachmentIds: string[]
    orgSlug: string
    userExternalId: string
  }) => Promise<void>
  markAssistantMessageFailed?: (input: {
    assistantMessageId: string
    conversationId: string
  }) => Promise<void>
}

export async function createAndDispatchWorkspaceChatMessage(
  input: {
    clientMessageId?: string
    conversationId: string
    orgSlug: string
    parts: WorkspaceChatMessageCreateRequest["parts"]
    userDisplayName: string
    userExternalId: string
  },
  dependencies: CreateAndDispatchWorkspaceChatMessageDependencies = {},
) {
  const createMessageRecord =
    dependencies.createMessageRecord ?? createWorkspaceChatMessageRecord
  const dispatchMessage =
    dependencies.dispatchMessage ?? dispatchWorkspaceChatMessage
  const validateAttachmentOwnership =
    dependencies.validateAttachmentOwnership ??
    validateWorkspaceChatAttachmentOwnership
  const markAssistantMessageFailed =
    dependencies.markAssistantMessageFailed ??
    markWorkspaceChatAssistantMessageFailed
  const attachmentIds = collectWorkspaceChatAttachmentIds(input.parts)

  await validateAttachmentOwnership({
    attachmentIds,
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
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
    console.info("[workspace-chat] dispatching runtime turn", {
      assistantMessageId: created.assistantMessageId ?? null,
      conversationId: created.conversationId,
      partsCount: created.message.parts.length,
      tenantId: created.tenantId,
    })

    const dispatchResult = await dispatchMessage({
      ...(created.assistantMessageId
        ? { assistantMessageId: created.assistantMessageId }
        : {}),
      conversationKind: created.conversationKind,
      conversationId: created.conversationId,
      conversationTitle: created.conversationTitle,
      conversationVisibility: created.conversationVisibility,
      parts: created.message.parts,
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
    console.error("[workspace-chat] runtime dispatch failed", {
      assistantMessageId: created.assistantMessageId ?? null,
      conversationId: created.conversationId,
      error: error instanceof Error ? error.message : error,
      tenantId: created.tenantId,
    })

    if (created.assistantMessageId) {
      await markAssistantMessageFailed({
        assistantMessageId: created.assistantMessageId,
        conversationId: created.conversationId,
      })
    }

    return {
      conversationId: created.conversationId,
      dispatch: {
        status: "failed",
      },
      message: created.message,
    } satisfies WorkspaceChatMessageCreateResponse
  }
}

function collectWorkspaceChatAttachmentIds(
  parts: WorkspaceChatMessageCreateRequest["parts"],
) {
  return parts.flatMap((part) => {
    if (part.type === "text" || part.type === "hidden_text") {
      return []
    }

    return [part.attachmentId]
  })
}
