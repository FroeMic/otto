import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearProjectChildCollectionCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  getLinearProjectUpdateFields,
  type LinearProjectNode,
  type LinearProjectUpdateNode,
  mapLinearProjectUpdate,
  normalizeLimit,
} from "../../client"

const LIST_PROJECT_UPDATES_QUERY = `
  query OttoLinearProjectListUpdates($id: String!, $limit: Int!) {
    project(id: $id) {
      ${getLinearProjectFields()}
      projectUpdates(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearProjectUpdateFields()}
        }
      }
    }
  }
`

export const executeLinearProjectListUpdates: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const projectId =
      typeof args.projectId === "string" ? args.projectId.trim() : ""

    if (!projectId) {
      throw new Error("linear project.list_updates requires projectId.")
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    })
    const data = await executeLinearGraphql<{
      project?:
        | (LinearProjectNode & {
            projectUpdates?: {
              nodes?: LinearProjectUpdateNode[] | null
            } | null
          })
        | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_UPDATES_QUERY,
      variables: {
        id: projectId,
        limit,
      },
    })

    if (!data.project) {
      throw new Error(`Linear could not find project ${projectId}.`)
    }

    return buildLinearProjectChildCollectionCommandResult({
      commandKey: "project.list_updates",
      items: (data.project.projectUpdates?.nodes ?? []).map(
        mapLinearProjectUpdate,
      ),
      limit,
      project: data.project,
    })
  }
