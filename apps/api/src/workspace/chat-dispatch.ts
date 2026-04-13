import type { WorkspaceChatMessagePart } from "@otto/feature-workspace-chat"

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"

type WorkspaceChatDispatchDependencies = {
  enqueueRunJob?: (input: {
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
    jobId: string
    status: "queued"
  }>
}

export async function dispatchWorkspaceChatMessage(
  input: {
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
  },
  dependencies: WorkspaceChatDispatchDependencies = {},
): Promise<{
  status: "queued"
}> {
  console.info("[workspace-chat] enqueueing runtime turn job", {
    assistantMessageId: input.assistantMessageId ?? null,
    conversationId: input.conversationId,
    partsCount: input.parts.length,
    tenantId: input.tenantId,
  })

  const enqueueRunJob =
    dependencies.enqueueRunJob ??
    (async (payload) => {
      const jobId = await enqueueJob({
        jobType: JOB_TYPES.runWorkspaceChatTurn,
        payload,
      })

      return {
        jobId,
        status: "queued" as const,
      }
    })
  const job = await enqueueRunJob({
    assistantMessageId: input.assistantMessageId,
    conversationKind: input.conversationKind,
    conversationId: input.conversationId,
    conversationTitle: input.conversationTitle,
    conversationVisibility: input.conversationVisibility,
    parts: input.parts,
    senderDisplayName: input.senderDisplayName,
    senderExternalId: input.senderExternalId,
    tenantId: input.tenantId,
    userMessageId: input.userMessageId,
  })

  console.info("[workspace-chat] runtime turn job enqueued", {
    assistantMessageId: input.assistantMessageId ?? null,
    conversationId: input.conversationId,
    jobId: "jobId" in job ? job.jobId : null,
    queueStatus: job.status,
    tenantId: input.tenantId,
  })

  return {
    status: job.status,
  }
}
