import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearProjectChildCollectionCommandResult,
  executeLinearGraphql,
  getLinearIssueFields,
  getLinearProjectFields,
  type LinearIssueNode,
  type LinearProjectNode,
  mapLinearIssue,
  normalizeLimit,
} from "../../client";

const LIST_PROJECT_ISSUES_QUERY = `
  query OttoLinearProjectListIssues($id: String!, $limit: Int!) {
    project(id: $id) {
      ${getLinearProjectFields()}
      issues(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearIssueFields()}
        }
      }
    }
  }
`;

export const executeLinearProjectListIssues: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const projectId =
      typeof args.projectId === "string" ? args.projectId.trim() : "";

    if (!projectId) {
      throw new Error("linear project.list_issues requires projectId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      project?:
        | (LinearProjectNode & {
            issues?: {
              nodes?: LinearIssueNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_ISSUES_QUERY,
      variables: {
        id: projectId,
        limit,
      },
    });

    if (!data.project) {
      throw new Error(`Linear could not find project ${projectId}.`);
    }

    return buildLinearProjectChildCollectionCommandResult({
      commandKey: "project.list_issues",
      items: (data.project.issues?.nodes ?? []).map(mapLinearIssue),
      limit,
      project: data.project,
    });
  };
