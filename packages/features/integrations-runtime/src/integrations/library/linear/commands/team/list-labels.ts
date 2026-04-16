import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearTeamChildCollectionCommandResult,
  executeLinearGraphql,
  findLinearTeamByIdOrKey,
  getLinearIssueLabelFields,
  type LinearIssueLabelNode,
  type LinearTeamNode,
  mapLinearIssueLabel,
  normalizeLimit,
  resolveLinearTeamId,
} from "../../client"

const LIST_TEAM_LABELS_QUERY = `
  query OttoLinearTeamListLabels($id: String!, $limit: Int!) {
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
        id
        name
        number
        description
        startsAt
        endsAt
        createdAt
        completedAt
        progress
        isActive
        isFuture
        isPast
        team {
          id
          key
          name
        }
      }
      parent {
        id
        key
        name
        displayName
      }
      labels(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearIssueLabelFields()}
        }
      }
    }
  }
`

export const executeLinearTeamListLabels: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const teamIdOrKey =
    typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : ""

  if (!teamIdOrKey) {
    throw new Error("linear team.list_labels requires teamIdOrKey.")
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
          labels?: {
            nodes?: LinearIssueLabelNode[] | null
          } | null
        })
      | null
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_TEAM_LABELS_QUERY,
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
      commandKey: "team.list_labels",
      items: (data.team?.labels?.nodes ?? []).map(mapLinearIssueLabel),
      limit,
      team,
    }),
    lookup: teamIdOrKey,
  }
}
