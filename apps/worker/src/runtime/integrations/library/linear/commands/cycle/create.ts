import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearCycleCommandResult,
  executeLinearGraphql,
  getLinearCycleFields,
  type LinearCycleNode,
} from "../../client";
import { buildLinearCycleCreateInput } from "./input";

const CREATE_CYCLE_MUTATION = `
  mutation OttoLinearCycleCreate($input: CycleCreateInput!) {
    cycleCreate(input: $input) {
      cycle {
        ${getLinearCycleFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearCycleCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const input = buildLinearCycleCreateInput(args);
  const data = await executeLinearGraphql<{
    cycleCreate?: {
      cycle?: LinearCycleNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_CYCLE_MUTATION,
    variables: {
      input,
    },
  });

  return buildLinearCycleCommandResult({
    commandKey: "cycle.create",
    cycle: data.cycleCreate?.cycle,
    lastSyncId: data.cycleCreate?.lastSyncId,
    success: data.cycleCreate?.success,
  });
};
