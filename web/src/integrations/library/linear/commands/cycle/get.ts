import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearCycleCommandResult,
  executeLinearGraphql,
  getLinearCycleFields,
  type LinearCycleNode,
} from "../../client";

const GET_CYCLE_QUERY = `
  query OttoLinearCycleGet($id: String!) {
    cycle(id: $id) {
      ${getLinearCycleFields()}
    }
  }
`;

export const executeLinearCycleGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const cycleId = typeof args.cycleId === "string" ? args.cycleId.trim() : "";

  if (!cycleId) {
    throw new Error("linear cycle.get requires cycleId.");
  }

  const data = await executeLinearGraphql<{
    cycle?: LinearCycleNode | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_CYCLE_QUERY,
    variables: {
      id: cycleId,
    },
  });

  return {
    ...buildLinearCycleCommandResult({
      commandKey: "cycle.get",
      cycle: data.cycle,
    }),
    lookup: cycleId,
  };
};
