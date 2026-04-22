import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
  resolveLinearTeamId,
} from "../../client"

const DELETE_TEAM_MUTATION = `
  mutation OttoLinearTeamDelete($id: String!) {
    teamDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`

export const executeLinearTeamDelete: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const teamIdOrKey =
    typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : ""

  if (!teamIdOrKey) {
    throw new Error("linear team.delete requires teamIdOrKey.")
  }

  const teamId = await resolveLinearTeamId({
    accessToken: context.auth.accessToken,
    teamIdOrKey,
  })

  const data = await executeLinearGraphql<{
    teamDelete?: {
      entityId?: string | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: DELETE_TEAM_MUTATION,
    variables: {
      id: teamId,
    },
  })

  return {
    ...buildLinearDeleteCommandResult({
      commandKey: "team.delete",
      entityId: data.teamDelete?.entityId || teamId,
      entityKey: "TeamId",
      lastSyncId: data.teamDelete?.lastSyncId,
      success: data.teamDelete?.success,
    }),
    lookup: teamIdOrKey,
  }
}
