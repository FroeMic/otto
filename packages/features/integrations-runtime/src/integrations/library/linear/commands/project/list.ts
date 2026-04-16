import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearProjectCollectionCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  type LinearProjectNode,
  normalizeLimit,
} from "../../client"

const LIST_PROJECTS_QUERY = `
  query OttoLinearProjectList($limit: Int!) {
    projects(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearProjectFields()}
      }
    }
  }
`

export const executeLinearProjectList: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const limit = normalizeLimit({
    defaultLimit: 10,
    max: 50,
    value: args.limit,
  })
  const data = await executeLinearGraphql<{
    projects?: {
      nodes?: LinearProjectNode[] | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_PROJECTS_QUERY,
    variables: {
      limit,
    },
  })

  return buildLinearProjectCollectionCommandResult({
    commandKey: "project.list",
    items: data.projects?.nodes ?? [],
    limit,
  })
}
