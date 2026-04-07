import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearUserIssueCollectionCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  getLinearUserFields,
  type LinearIssueNode,
  type LinearUserNode,
  normalizeLimit,
} from "../../client";

const LIST_CREATED_ISSUES_QUERY = `
  query OttoLinearUserListCreatedIssues($id: String!, $limit: Int!) {
    user(id: $id) {
      ${getLinearUserFields()}
      createdIssues(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearIssueFields()}
        }
      }
    }
  }
`;

export const executeLinearUserListCreatedIssues: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const userId = typeof args.userId === "string" ? args.userId.trim() : "";

    if (!userId) {
      throw new Error("linear user.list_created_issues requires userId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });

    const data = await executeLinearGraphql<{
      user?: (LinearUserNode & {
        createdIssues?: {
          nodes?: LinearIssueNode[] | null;
        } | null;
      }) | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_CREATED_ISSUES_QUERY,
      variables: {
        id: userId,
        limit,
      },
    });

    if (!data.user) {
      throw new Error("Linear returned no user for user.list_created_issues.");
    }

    return {
      ...buildLinearUserIssueCollectionCommandResult({
        commandKey: "user.list_created_issues",
        items: data.user.createdIssues?.nodes ?? [],
        limit,
        user: data.user,
      }),
      lookup: userId,
    };
  };
