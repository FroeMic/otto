import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearTeamChildCollectionCommandResult,
  executeLinearGraphql,
  findLinearTeamByIdOrKey,
  getLinearCycleFields,
  type LinearCycleNode,
  type LinearTeamNode,
  mapLinearCycle,
  normalizeLimit,
  resolveLinearTeamId,
} from "../../client"

const LIST_TEAM_CYCLES_QUERY = `
  query OttoLinearTeamListCycles($id: String!, $limit: Int!) {
    team(id: $id) {
      id
      key
      name
      displayName
      description
      color
      icon
      private
      cyclesEnabled
      triageEnabled
      issueCount
      createdAt
      updatedAt
      archivedAt
      retiredAt
      activeCycle {
        ${getLinearCycleFields()}
      }
      parent {
        id
        key
        name
        displayName
      }
      cycles(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearCycleFields()}
        }
      }
    }
  }
`

export const executeLinearTeamListCycles: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const teamIdOrKey =
    typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : ""

  if (!teamIdOrKey) {
    throw new Error("linear team.list_cycles requires teamIdOrKey.")
  }

  const teamId = await resolveLinearTeamId({
    accessToken: context.auth.accessToken,
    teamIdOrKey,
  })
  const limit = normalizeLimit({
    defaultLimit: 25,
    max: 100,
    value: args.limit,
  })
  const data = await executeLinearGraphql<{
    team?:
      | (LinearTeamNode & {
          cycles?: {
            nodes?: LinearCycleNode[] | null
          } | null
        })
      | null
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_TEAM_CYCLES_QUERY,
    variables: {
      id: teamId,
      limit,
    },
  })

  const team =
    data.team ??
    (await findLinearTeamByIdOrKey({
      accessToken: context.auth.accessToken,
      teamIdOrKey,
    }))

  if (!team) {
    throw new Error(`Linear could not find team ${teamIdOrKey}.`)
  }

  return {
    ...buildLinearTeamChildCollectionCommandResult({
      commandKey: "team.list_cycles",
      items: (data.team?.cycles?.nodes ?? []).map(mapLinearCycle),
      limit,
      team,
    }),
    lookup: teamIdOrKey,
  }
}
