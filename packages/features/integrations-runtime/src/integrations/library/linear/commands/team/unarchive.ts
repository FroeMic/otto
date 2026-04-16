import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearTeamCommandResult,
  executeLinearGraphql,
  getLinearTeamFields,
  type LinearTeamNode,
  resolveLinearTeamId,
} from "../../client"

const UNARCHIVE_TEAM_MUTATION = `
  mutation OttoLinearTeamUnarchive($id: String!) {
    teamUnarchive(id: $id) {
      entity {
        ${getLinearTeamFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearTeamUnarchive: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const teamIdOrKey =
    typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : ""

  if (!teamIdOrKey) {
    throw new Error("linear team.unarchive requires teamIdOrKey.")
  }

  const teamId = await resolveLinearTeamId({
    accessToken: context.auth.accessToken,
    teamIdOrKey,
  })

  const data = await executeLinearGraphql<{
    teamUnarchive?: {
      entity?: LinearTeamNode | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: UNARCHIVE_TEAM_MUTATION,
    variables: {
      id: teamId,
    },
  })

  return {
    ...buildLinearTeamCommandResult({
      commandKey: "team.unarchive",
      lastSyncId: data.teamUnarchive?.lastSyncId,
      success: data.teamUnarchive?.success,
      team: data.teamUnarchive?.entity,
    }),
    lookup: teamIdOrKey,
  }
}
