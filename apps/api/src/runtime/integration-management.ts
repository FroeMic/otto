type RuntimeIntegrationConnectionAction = {
  availableActions: string[]
  connectUrl: string | null
  integrationKey: string
  label: string
  message: string
  recommendedAction: string
  requiresUserAction: boolean
  selectedAction: string
  status: {
    connected: boolean
    connectionStatus: string | null
    enabled: boolean
    integrationStatus: string | null
    needsAttention: boolean
  }
  workspaceUrl: string | null
}

export async function manageRuntimeIntegrationConnection(input: {
  action: string
  enableRuntimeIntegrationForTenant: (input: {
    integrationKey: string
    tenantId: string
  }) => Promise<void>
  getRuntimeIntegrationConnectionActionForTenant: (input: {
    action?: string | null
    integrationKey: string
    tenantId: string
  }) => Promise<RuntimeIntegrationConnectionAction | null>
  integrationKey: string
  tenantId: string
}) {
  const connectionAction =
    await input.getRuntimeIntegrationConnectionActionForTenant({
      action: input.action,
      integrationKey: input.integrationKey,
      tenantId: input.tenantId,
    })

  if (!connectionAction) {
    return null
  }

  const requestedAction = input.action.trim().toLowerCase()

  if (
    requestedAction === "enable" &&
    connectionAction.integrationKey === "gandi" &&
    connectionAction.selectedAction === "enable"
  ) {
    await input.enableRuntimeIntegrationForTenant({
      integrationKey: input.integrationKey,
      tenantId: input.tenantId,
    })

    return input.getRuntimeIntegrationConnectionActionForTenant({
      action: "open_workspace",
      integrationKey: input.integrationKey,
      tenantId: input.tenantId,
    })
  }

  return connectionAction
}
