import type { IntegrationCommandExecute } from "../../../../framework"

import { executeLinearGraphql, normalizeLimit } from "../../client"

const LIST_PROJECT_STATUSES_QUERY = `
  query OttoLinearListProjectStatuses($limit: Int!) {
    projectStatuses(first: $limit) {
      nodes {
        id
        name
        description
        color
        position
        type
        indefinite
        createdAt
        updatedAt
      }
    }
  }
`

export const executeLinearWorkspaceListProjectStatuses: IntegrationCommandExecute =
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
      projectStatuses?: {
        nodes?: Array<{
          color?: string | null
          createdAt?: string | null
          description?: string | null
          id: string
          indefinite?: boolean | null
          name?: string | null
          position?: number | null
          type?: string | null
          updatedAt?: string | null
        }> | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_STATUSES_QUERY,
      variables: {
        limit,
      },
    })

    return {
      commandKey: "workspace.list_project_statuses",
      integrationKey: "linear",
      items: (data.projectStatuses?.nodes ?? []).map((status) => ({
        color: status.color?.trim() || null,
        createdAt: status.createdAt ?? null,
        description: status.description?.trim() || null,
        id: status.id,
        indefinite: Boolean(status.indefinite),
        name: status.name?.trim() || "Unnamed project status",
        position: typeof status.position === "number" ? status.position : null,
        type: status.type?.trim() || null,
        updatedAt: status.updatedAt ?? null,
      })),
      limit,
      source: "linear",
    }
  }
