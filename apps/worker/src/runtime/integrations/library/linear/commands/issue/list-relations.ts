import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearIssueCollectionCommandResult,
  executeLinearGraphql,
  findLinearIssueByIdentifierOrId,
  getLinearIssueFields,
  getLinearIssueRelationFields,
  type LinearIssueNode,
  type LinearIssueRelationNode,
  mapLinearIssueRelation,
  normalizeLimit,
} from "../../client"

const LIST_ISSUE_RELATIONS_QUERY = `
  query OttoLinearIssueListRelations($id: String!, $limit: Int!) {
    issue(id: $id) {
      ${getLinearIssueFields()}
      relations(first: $limit) {
        nodes {
          ${getLinearIssueRelationFields()}
        }
      }
      inverseRelations(first: $limit) {
        nodes {
          ${getLinearIssueRelationFields()}
        }
      }
    }
  }
`

export const executeLinearIssueListRelations: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const identifierOrId =
      typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : ""

    if (!identifierOrId) {
      throw new Error("linear issue.list_relations requires identifierOrId.")
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    })
    const issue = await findLinearIssueByIdentifierOrId({
      accessToken: context.auth.accessToken,
      identifierOrId,
    })

    if (!issue?.id) {
      throw new Error(`Linear could not find issue ${identifierOrId}.`)
    }

    const data = await executeLinearGraphql<{
      issue?:
        | (LinearIssueNode & {
            inverseRelations?: {
              nodes?: LinearIssueRelationNode[] | null
            } | null
            relations?: {
              nodes?: LinearIssueRelationNode[] | null
            } | null
          })
        | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_ISSUE_RELATIONS_QUERY,
      variables: {
        id: issue.id,
        limit,
      },
    })

    if (!data.issue) {
      throw new Error(
        `Linear could not load relations for issue ${identifierOrId}.`,
      )
    }

    const items = [
      ...(data.issue.relations?.nodes ?? []).map((relation) => ({
        ...mapLinearIssueRelation(relation),
        direction: "outgoing" as const,
      })),
      ...(data.issue.inverseRelations?.nodes ?? []).map((relation) => ({
        ...mapLinearIssueRelation(relation),
        direction: "incoming" as const,
      })),
    ]

    return {
      ...buildLinearIssueCollectionCommandResult({
        commandKey: "issue.list_relations",
        issue: data.issue,
        items,
        limit,
      }),
      lookup: identifierOrId,
    }
  }
