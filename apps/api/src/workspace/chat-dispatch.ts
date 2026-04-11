import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"

type WorkspaceChatDispatchDependencies = {
  enqueueRunJob?: (input: {
    assistantMessageId?: string
    conversationId: string
    message: string
    tenantId: string
  }) => Promise<{
    jobId: string
    status: "queued"
  }>
}

export async function dispatchWorkspaceChatMessage(
  input: {
    assistantMessageId?: string
    conversationId: string
    message: string
    tenantId: string
  },
  dependencies: WorkspaceChatDispatchDependencies = {},
): Promise<{
  status: "queued"
}> {
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
    conversationId: input.conversationId,
    message: input.message,
    tenantId: input.tenantId,
  })

  return {
    status: job.status,
  }
}
