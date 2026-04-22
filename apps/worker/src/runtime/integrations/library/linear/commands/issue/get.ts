import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearIssueCommandResult,
  findLinearIssueByIdentifierOrId,
} from "../../client"

export const executeLinearIssueGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const identifierOrId =
    typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : ""

  if (!identifierOrId) {
    throw new Error("linear issue.get requires identifierOrId.")
  }

  const issue = await findLinearIssueByIdentifierOrId({
    accessToken: context.auth.accessToken,
    identifierOrId,
  })

  if (!issue) {
    throw new Error(`Linear could not find issue ${identifierOrId}.`)
  }

  return {
    ...buildLinearIssueCommandResult({
      commandKey: "issue.get",
      issue,
    }),
    commandKey: "issue.get",
    lookup: identifierOrId,
  }
}
