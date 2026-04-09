import { LinearGraphqlError } from "@/integrations/library/linear/client"

export function buildExecutionErrorResponse(input: {
  commandKey?: string
  error: unknown
}) {
  const message =
    input.error instanceof Error
      ? input.error.message
      : "Managed integration execution failed"

  if (message.includes("needs attention. Reconnect")) {
    const integrationLabel = message.split(" needs attention")[0]?.trim()
    const integrationKey = integrationLabel?.toLowerCase()

    return {
      error: message,
      nextAction: integrationKey
        ? {
            integrationKey,
            recommendedAction: "reconnect",
            toolName: "manage_integration",
          }
        : null,
    }
  }

  if (
    message.includes("requires the") ||
    message.includes("does not accept the") ||
    message.includes("requires ") ||
    message.includes("requires query to be at least")
  ) {
    return {
      error: message,
      hint: "Call find_integration_commands, then inspect the chosen command with get_integration_details before retrying.",
    }
  }

  if (
    input.error instanceof LinearGraphqlError &&
    input.error.code === "FORBIDDEN" &&
    input.commandKey?.startsWith("team.") &&
    input.commandKey !== "team.create"
  ) {
    if (
      input.commandKey === "team.delete" ||
      input.commandKey === "team.unarchive"
    ) {
      return {
        error: message,
        hint: "Otto's current Linear actor may need workspace-admin or team-owner permissions before retrying this team command.",
      }
    }

    return {
      error: message,
      hint: "Otto may need to be added to that Linear team before retrying this team command.",
    }
  }

  return {
    error: message,
  }
}
