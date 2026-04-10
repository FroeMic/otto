import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearProjectChildCollectionCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  getLinearProjectLabelFields,
  type LinearProjectLabelNode,
  type LinearProjectNode,
  mapLinearProjectLabel,
  normalizeLimit,
} from "../../client";

const LIST_PROJECT_LABELS_QUERY = `
  query OttoLinearProjectListLabels($id: String!, $limit: Int!) {
    project(id: $id) {
      ${getLinearProjectFields()}
      labels(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearProjectLabelFields()}
        }
      }
    }
  }
`;

export const executeLinearProjectListLabels: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const projectId =
      typeof args.projectId === "string" ? args.projectId.trim() : "";

    if (!projectId) {
      throw new Error("linear project.list_labels requires projectId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      project?:
        | (LinearProjectNode & {
            labels?: {
              nodes?: LinearProjectLabelNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_LABELS_QUERY,
      variables: {
        id: projectId,
        limit,
      },
    });

    if (!data.project) {
      throw new Error(`Linear could not find project ${projectId}.`);
    }

    return buildLinearProjectChildCollectionCommandResult({
      commandKey: "project.list_labels",
      items: (data.project.labels?.nodes ?? []).map(mapLinearProjectLabel),
      limit,
      project: data.project,
    });
  };
