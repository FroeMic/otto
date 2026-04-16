import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearUserTeamMembershipCollectionCommandResult,
  executeLinearGraphql,
  getLinearTeamReferenceFields,
  getLinearUserFields,
  type LinearTeamMembershipNode,
  type LinearUserNode,
  normalizeLimit,
} from "../../client"

const LIST_TEAM_MEMBERSHIPS_QUERY = `
  query OttoLinearUserListTeamMemberships($id: String!, $limit: Int!) {
    user(id: $id) {
      ${getLinearUserFields()}
      teamMemberships(first: $limit, orderBy: updatedAt) {
        nodes {
          id
          owner
          sortOrder
          createdAt
          updatedAt
          team {
            ${getLinearTeamReferenceFields()}
          }
          user {
            ${getLinearUserFields()}
          }
        }
      }
    }
  }
`

export const executeLinearUserListTeamMemberships: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const userId = typeof args.userId === "string" ? args.userId.trim() : ""

    if (!userId) {
      throw new Error("linear user.list_team_memberships requires userId.")
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    })

    const data = await executeLinearGraphql<{
      user?:
        | (LinearUserNode & {
            teamMemberships?: {
              nodes?: LinearTeamMembershipNode[] | null
            } | null
          })
        | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_TEAM_MEMBERSHIPS_QUERY,
      variables: {
        id: userId,
        limit,
      },
    })

    if (!data.user) {
      throw new Error("Linear returned no user for user.list_team_memberships.")
    }

    return {
      ...buildLinearUserTeamMembershipCollectionCommandResult({
        commandKey: "user.list_team_memberships",
        items: data.user.teamMemberships?.nodes ?? [],
        limit,
        user: data.user,
      }),
      lookup: userId,
    }
  }
