import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearProjectCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  type LinearProjectNode,
} from "../../client";
import { buildLinearProjectCreateInput } from "./input";

const CREATE_PROJECT_MUTATION = `
  mutation OttoLinearProjectCreate($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      lastSyncId
      project {
        ${getLinearProjectFields()}
      }
      success
    }
  }
`;

export const executeLinearProjectCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const input = buildLinearProjectCreateInput(args);
  const data = await executeLinearGraphql<{
    projectCreate?: {
      lastSyncId?: number | null;
      project?: LinearProjectNode | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_PROJECT_MUTATION,
    variables: {
      input,
    },
  });

  return buildLinearProjectCommandResult({
    commandKey: "project.create",
    lastSyncId: data.projectCreate?.lastSyncId,
    project: data.projectCreate?.project,
    success: data.projectCreate?.success,
  });
};
