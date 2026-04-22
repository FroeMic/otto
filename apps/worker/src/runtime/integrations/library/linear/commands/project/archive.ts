import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearProjectCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  type LinearProjectNode,
} from "../../client"

const ARCHIVE_PROJECT_MUTATION = `
  mutation OttoLinearProjectArchive($id: String!, $trash: Boolean) {
    projectArchive(id: $id, trash: $trash) {
      entity {
        ${getLinearProjectFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearProjectArchive: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const projectId =
    typeof args.projectId === "string" ? args.projectId.trim() : ""
  const trash = typeof args.trash === "boolean" ? args.trash : false

  if (!projectId) {
    throw new Error("linear project.archive requires projectId.")
  }

  const data = await executeLinearGraphql<{
    projectArchive?: {
      entity?: LinearProjectNode | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: ARCHIVE_PROJECT_MUTATION,
    variables: {
      id: projectId,
      trash,
    },
  })

  return buildLinearProjectCommandResult({
    commandKey: "project.archive",
    lastSyncId: data.projectArchive?.lastSyncId,
    project: data.projectArchive?.entity,
    success: data.projectArchive?.success,
  })
}
