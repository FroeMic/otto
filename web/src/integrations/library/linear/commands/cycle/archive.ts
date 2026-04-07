import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearCycleCommandResult,
  executeLinearGraphql,
  getLinearCycleFields,
  type LinearCycleNode,
} from "../../client";

const ARCHIVE_CYCLE_MUTATION = `
  mutation OttoLinearCycleArchive($id: String!) {
    cycleArchive(id: $id) {
      entity {
        ${getLinearCycleFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearCycleArchive: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const cycleId = typeof args.cycleId === "string" ? args.cycleId.trim() : "";

  if (!cycleId) {
    throw new Error("linear cycle.archive requires cycleId.");
  }

  const data = await executeLinearGraphql<{
    cycleArchive?: {
      entity?: LinearCycleNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: ARCHIVE_CYCLE_MUTATION,
    variables: {
      id: cycleId,
    },
  });

  return {
    ...buildLinearCycleCommandResult({
      commandKey: "cycle.archive",
      cycle: data.cycleArchive?.entity,
      lastSyncId: data.cycleArchive?.lastSyncId,
      success: data.cycleArchive?.success,
    }),
    lookup: cycleId,
  };
};
