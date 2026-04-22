import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearIssueCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
} from "../../client"
import { buildLinearIssueCreateInput } from "./input"

const CREATE_ISSUE_MUTATION = `
  mutation OttoLinearIssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      issue {
        ${getLinearIssueFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearIssueCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const input = buildLinearIssueCreateInput(args)
  const data = await executeLinearGraphql<{
    issueCreate?: {
      issue?: LinearIssueNode | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_ISSUE_MUTATION,
    variables: {
      input,
    },
  })

  return buildLinearIssueCommandResult({
    commandKey: "issue.create",
    issue: data.issueCreate?.issue,
    lastSyncId: data.issueCreate?.lastSyncId,
    success: data.issueCreate?.success,
  })
}
