import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearProjectCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  type LinearProjectNode,
} from "../../client";

const GET_PROJECT_QUERY = `
  query OttoLinearProjectGet($id: String!) {
    project(id: $id) {
      ${getLinearProjectFields()}
    }
  }
`;

export const executeLinearProjectGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const projectId =
    typeof args.projectId === "string" ? args.projectId.trim() : "";

  if (!projectId) {
    throw new Error("linear project.get requires projectId.");
  }

  const data = await executeLinearGraphql<{
    project?: LinearProjectNode | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_PROJECT_QUERY,
    variables: {
      id: projectId,
    },
  });

  return {
    ...buildLinearProjectCommandResult({
      commandKey: "project.get",
      project: data.project,
    }),
    lookup: projectId,
  };
};
