import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearDocumentCommandResult,
  executeLinearGraphql,
  getLinearDocumentFields,
  type LinearDocumentNode,
} from "../../client"

const GET_DOCUMENT_QUERY = `
  query OttoLinearDocumentGet($id: String!) {
    document(id: $id) {
      ${getLinearDocumentFields()}
    }
  }
`

export const executeLinearDocumentGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const documentId =
    typeof args.documentId === "string" ? args.documentId.trim() : ""

  if (!documentId) {
    throw new Error("linear document.get requires documentId.")
  }

  const data = await executeLinearGraphql<{
    document?: LinearDocumentNode | null
  }>({
    accessToken: context.auth.accessToken,
    query: GET_DOCUMENT_QUERY,
    variables: {
      id: documentId,
    },
  })

  return {
    ...buildLinearDocumentCommandResult({
      commandKey: "document.get",
      document: data.document,
    }),
    lookup: documentId,
  }
}
