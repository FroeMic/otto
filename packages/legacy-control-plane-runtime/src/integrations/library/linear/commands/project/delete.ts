import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
} from "../../client";

const DELETE_PROJECT_MUTATION = `
  mutation OttoLinearProjectDelete($id: String!) {
    projectDelete(id: $id) {
      entity {
        id
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearProjectDelete: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const projectId =
    typeof args.projectId === "string" ? args.projectId.trim() : "";

  if (!projectId) {
    throw new Error("linear project.delete requires projectId.");
  }

  const data = await executeLinearGraphql<{
    projectDelete?: {
      entity?: {
        id?: string | null;
      } | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: DELETE_PROJECT_MUTATION,
    variables: {
      id: projectId,
    },
  });

  return {
    ...buildLinearDeleteCommandResult({
      commandKey: "project.delete",
      entityId: data.projectDelete?.entity?.id,
      entityKey: "ProjectId",
      lastSyncId: data.projectDelete?.lastSyncId,
      success: data.projectDelete?.success,
    }),
    lookup: projectId,
  };
};
