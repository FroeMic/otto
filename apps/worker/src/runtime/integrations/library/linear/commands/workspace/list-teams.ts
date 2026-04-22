import type { IntegrationCommandExecute } from "../../../../framework"

import { executeLinearGraphql, normalizeLimit } from "../../client"

const LIST_TEAMS_QUERY = `
  query OttoLinearListTeams($limit: Int!) {
    teams(first: $limit) {
      nodes {
        id
        key
        name
        description
      }
    }
  }
`

export const executeLinearWorkspaceListTeams: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
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
        nodes?: Array<{
          description?: string | null
          id: string
          key?: string | null
          name?: string | null
        }> | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_TEAMS_QUERY,
      variables: {
        limit,
      },
    })

    return {
      commandKey: "workspace.list_teams",
      integrationKey: "linear",
      items: (data.teams?.nodes ?? []).map((team) => ({
        description: team.description?.trim() || null,
        id: team.id,
        key: team.key?.trim() || null,
        name: team.name?.trim() || "Untitled team",
      })),
      limit,
      source: "linear",
    }
  }
