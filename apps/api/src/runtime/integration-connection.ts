import type { RuntimeIntegrationSummaryResponse } from "@otto/feature-integrations-runtime/integrations/framework"

export function buildRuntimeIntegrationConnectionAction(input: {
  connectUrl: string | null
  integration: Pick<
    RuntimeIntegrationSummaryResponse,
    "key" | "label" | "status"
  >
  requestedAction: string
  workspaceUrl: string | null
}) {
  let recommendedAction = "none"
  let message = `${input.integration.label} is available.`

  switch (input.integration.key) {
    case "brave":
      recommendedAction = "open_workspace"
      message =
        "Brave web search is platform-managed by Otto. Open the workspace integration page to inspect its status and projected defaults."
      break
    case "gandi":
      recommendedAction = input.integration.status.connected
        ? "open_workspace"
        : "enable"
      message = input.integration.status.connected
        ? "Gandi is enabled for this workspace. Open the workspace integration page to review company naming and domain research availability."
        : "Gandi is not enabled yet. Otto can enable it now for company naming and domain research, or you can open the workspace integration page."
      break
    case "linear":
      recommendedAction = input.integration.status.connected
        ? "open_workspace"
        : "connect"
      message = input.integration.status.connected
        ? "Linear is already connected. Open the workspace integration page if the user wants to review or reconnect it."
        : "Linear is not connected yet. Ask the user to connect it in the workspace."
      break
    case "slack":
      recommendedAction = input.integration.status.connected
        ? "open_workspace"
        : "connect"
      message = input.integration.status.connected
        ? "Slack is connected. Open the workspace integration page to review, reconnect, or disconnect it."
        : "Slack is not connected yet. Ask the user to connect it in the workspace."
      break
  }

  const availableActions = [
    input.workspaceUrl ? "open_workspace" : null,
    input.integration.key === "gandi" && !input.integration.status.connected
      ? "enable"
      : null,
    input.connectUrl ? "connect" : null,
    input.connectUrl ? "reconnect" : null,
  ].filter((entry): entry is string => Boolean(entry))
  const selectedAction =
    input.requestedAction && availableActions.includes(input.requestedAction)
      ? input.requestedAction
      : recommendedAction

  return {
    availableActions,
    connectUrl: input.connectUrl,
    integrationKey: input.integration.key,
    label: input.integration.label,
    message,
    recommendedAction,
    requiresUserAction:
      selectedAction === "connect" || selectedAction === "reconnect",
    selectedAction,
    status: input.integration.status,
    workspaceUrl: input.workspaceUrl,
  }
}
