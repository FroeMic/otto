import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearIssueCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  resolveLinearIssueId,
} from "../../client"

const ISSUE_REMOVE_LABEL_MUTATION = `
  mutation OttoLinearIssueRemoveLabel($id: String!, $labelId: String!) {
    issueRemoveLabel(id: $id, labelId: $labelId) {
      issue {
        ${getLinearIssueFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearIssueRemoveLabel: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const identifierOrId =
    typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : ""
  const labelId = typeof args.labelId === "string" ? args.labelId.trim() : ""

  if (!identifierOrId || !labelId) {
    throw new Error(
      "linear issue.remove_label requires identifierOrId and labelId.",
    )
  }

  const id = await resolveLinearIssueId({
    accessToken: context.auth.accessToken,
    identifierOrId,
  })
  const data = await executeLinearGraphql<{
    issueRemoveLabel?: {
      issue?: LinearIssueNode | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: ISSUE_REMOVE_LABEL_MUTATION,
    variables: {
      id,
      labelId,
    },
  })

  return {
    ...buildLinearIssueCommandResult({
      commandKey: "issue.remove_label",
      issue: data.issueRemoveLabel?.issue,
      lastSyncId: data.issueRemoveLabel?.lastSyncId,
      success: data.issueRemoveLabel?.success,
    }),
    labelId,
    lookup: identifierOrId,
  }
}
