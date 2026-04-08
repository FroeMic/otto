import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
} from "../../client";

const DELETE_PROJECT_MUTATION = `
  mutation OttoLinearProjectDelete($id: String!) {
    projectDelete(id: $id) {
      entityId
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
      entityId?: string | null;
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
      entityId: data.projectDelete?.entityId,
      entityKey: "ProjectId",
      lastSyncId: data.projectDelete?.lastSyncId,
      success: data.projectDelete?.success,
    }),
    lookup: projectId,
  };
};
