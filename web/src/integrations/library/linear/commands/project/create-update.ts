import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  executeLinearGraphql,
  getLinearProjectUpdateFields,
  type LinearProjectUpdateNode,
  mapLinearProjectUpdate,
} from "../../client";
import { buildLinearProjectUpdateCreateInput } from "./input";

const CREATE_PROJECT_UPDATE_MUTATION = `
  mutation OttoLinearProjectCreateUpdate($input: ProjectUpdateCreateInput!) {
    projectUpdateCreate(input: $input) {
      lastSyncId
      projectUpdate {
        ${getLinearProjectUpdateFields()}
      }
      success
    }
  }
`;

export const executeLinearProjectCreateUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const input = buildLinearProjectUpdateCreateInput(args);
    const data = await executeLinearGraphql<{
      projectUpdateCreate?: {
        lastSyncId?: number | null;
        projectUpdate?: LinearProjectUpdateNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_PROJECT_UPDATE_MUTATION,
      variables: {
        input,
      },
    });

    return {
      commandKey: "project.create_update",
      integrationKey: "linear",
      lastSyncId:
        typeof data.projectUpdateCreate?.lastSyncId === "number"
          ? data.projectUpdateCreate.lastSyncId
          : null,
      projectUpdate: data.projectUpdateCreate?.projectUpdate
        ? mapLinearProjectUpdate(data.projectUpdateCreate.projectUpdate)
        : null,
      source: "linear",
      success: data.projectUpdateCreate?.success ?? true,
    };
  };
