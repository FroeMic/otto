import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearProjectChildCollectionCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  getLinearProjectMilestoneFields,
  type LinearProjectMilestoneNode,
  type LinearProjectNode,
  mapLinearProjectMilestone,
  normalizeLimit,
} from "../../client";

const LIST_PROJECT_MILESTONES_QUERY = `
  query OttoLinearProjectListMilestones($id: String!, $limit: Int!) {
    project(id: $id) {
      ${getLinearProjectFields()}
      projectMilestones(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearProjectMilestoneFields()}
        }
      }
    }
  }
`;

export const executeLinearProjectListMilestones: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const projectId =
      typeof args.projectId === "string" ? args.projectId.trim() : "";

    if (!projectId) {
      throw new Error("linear project.list_milestones requires projectId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      project?:
        | (LinearProjectNode & {
            projectMilestones?: {
              nodes?: LinearProjectMilestoneNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_MILESTONES_QUERY,
      variables: {
        id: projectId,
        limit,
      },
    });

    if (!data.project) {
      throw new Error(`Linear could not find project ${projectId}.`);
    }

    return buildLinearProjectChildCollectionCommandResult({
      commandKey: "project.list_milestones",
      items: (data.project.projectMilestones?.nodes ?? []).map(
        mapLinearProjectMilestone,
      ),
      limit,
      project: data.project,
    });
  };
