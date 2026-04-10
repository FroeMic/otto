import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearProjectCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  type LinearProjectNode,
} from "../../client";
import { buildLinearProjectUpdateInput } from "./input";

const UPDATE_PROJECT_MUTATION = `
  mutation OttoLinearProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
    projectUpdate(id: $id, input: $input) {
      lastSyncId
      project {
        ${getLinearProjectFields()}
      }
      success
    }
  }
`;

export const executeLinearProjectUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const projectId =
    typeof args.projectId === "string" ? args.projectId.trim() : "";

  if (!projectId) {
    throw new Error("linear project.update requires projectId.");
  }

  const input = buildLinearProjectUpdateInput(args);
  const data = await executeLinearGraphql<{
    projectUpdate?: {
      lastSyncId?: number | null;
      project?: LinearProjectNode | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_PROJECT_MUTATION,
    variables: {
      id: projectId,
      input,
    },
  });

  return buildLinearProjectCommandResult({
    commandKey: "project.update",
    lastSyncId: data.projectUpdate?.lastSyncId,
    project: data.projectUpdate?.project,
    success: data.projectUpdate?.success,
  });
};
