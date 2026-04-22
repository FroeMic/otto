import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearTeamCollectionCommandResult,
  executeLinearGraphql,
  getLinearTeamFields,
  type LinearTeamNode,
  normalizeLimit,
} from "../../client"

const LIST_TEAMS_QUERY = `
  query OttoLinearTeamList($limit: Int!) {
    teams(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearTeamFields()}
      }
    }
  }
`

export const executeLinearTeamList: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const limit = normalizeLimit({
    defaultLimit: 25,
    max: 100,
    value: args.limit,
  })
  const data = await executeLinearGraphql<{
    teams?: {
      nodes?: LinearTeamNode[] | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_TEAMS_QUERY,
    variables: {
      limit,
    },
  })

  return buildLinearTeamCollectionCommandResult({
    commandKey: "team.list",
    items: data.teams?.nodes ?? [],
    limit,
  })
}
