import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearProjectChildCollectionCommandResult,
  executeLinearGraphql,
  getLinearDocumentFields,
  getLinearProjectFields,
  type LinearDocumentNode,
  type LinearProjectNode,
  mapLinearDocument,
  normalizeLimit,
} from "../../client"

const LIST_PROJECT_DOCUMENTS_QUERY = `
  query OttoLinearProjectListDocuments($id: String!, $limit: Int!) {
    project(id: $id) {
      ${getLinearProjectFields()}
      documents(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearDocumentFields()}
        }
      }
    }
  }
`

export const executeLinearProjectListDocuments: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const projectId =
      typeof args.projectId === "string" ? args.projectId.trim() : ""

    if (!projectId) {
      throw new Error("linear project.list_documents requires projectId.")
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    })
    const data = await executeLinearGraphql<{
      project?:
        | (LinearProjectNode & {
            documents?: {
              nodes?: LinearDocumentNode[] | null
            } | null
          })
        | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_DOCUMENTS_QUERY,
      variables: {
        id: projectId,
        limit,
      },
    })

    if (!data.project) {
      throw new Error(`Linear could not find project ${projectId}.`)
    }

    return buildLinearProjectChildCollectionCommandResult({
      commandKey: "project.list_documents",
      items: (data.project.documents?.nodes ?? []).map(mapLinearDocument),
      limit,
      project: data.project,
    })
  }
