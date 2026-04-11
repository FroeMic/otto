import { enqueueWorkspaceChatBridgeCommand } from "../runtime/bridge-commands-data"

type WorkspaceChatDispatchDependencies = {
  enqueueBridgeCommand?: (input: {
    assistantMessageId?: string
    conversationId: string
    message: string
    tenantId: string
  }) => Promise<{
    commandId: string
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
  const enqueueBridgeCommand =
    dependencies.enqueueBridgeCommand ?? enqueueWorkspaceChatBridgeCommand
  const command = await enqueueBridgeCommand({
    assistantMessageId: input.assistantMessageId,
    conversationId: input.conversationId,
    message: input.message,
    tenantId: input.tenantId,
  })

  return {
    status: command.status,
  }
}
