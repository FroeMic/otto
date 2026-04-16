import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearDocumentCommandResult,
  executeLinearGraphql,
  getLinearDocumentFields,
  type LinearDocumentNode,
} from "../../client"
import { buildLinearDocumentCreateInput } from "./input"

const CREATE_DOCUMENT_MUTATION = `
  mutation OttoLinearDocumentCreate($input: DocumentCreateInput!) {
    documentCreate(input: $input) {
      document {
        ${getLinearDocumentFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearDocumentCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const input = buildLinearDocumentCreateInput(args)
  const data = await executeLinearGraphql<{
    documentCreate?: {
      document?: LinearDocumentNode | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_DOCUMENT_MUTATION,
    variables: {
      input,
    },
  })

  return buildLinearDocumentCommandResult({
    commandKey: "document.create",
    document: data.documentCreate?.document,
    lastSyncId: data.documentCreate?.lastSyncId,
    success: data.documentCreate?.success,
  })
}
