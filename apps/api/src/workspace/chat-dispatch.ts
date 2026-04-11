import { enqueueWorkspaceChatBridgeCommand } from "../runtime/bridge-commands-data"

type WorkspaceChatDispatchDependencies = {
  enqueueBridgeCommand?: (input: {
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
    conversationId: input.conversationId,
    message: input.message,
    tenantId: input.tenantId,
  })

  return {
    status: command.status,
  }
}
