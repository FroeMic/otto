import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearTeamCommandResult,
  executeLinearGraphql,
  getLinearTeamFields,
  type LinearTeamNode,
  resolveLinearTeamId,
} from "../../client";
import { buildLinearTeamUpdateInput } from "./input";

const UPDATE_TEAM_MUTATION = `
  mutation OttoLinearTeamUpdate($id: String!, $input: TeamUpdateInput!) {
    teamUpdate(id: $id, input: $input) {
      lastSyncId
      success
      team {
        ${getLinearTeamFields()}
      }
    }
  }
`;

export const executeLinearTeamUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const teamIdOrKey =
    typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : "";

  if (!teamIdOrKey) {
    throw new Error("linear team.update requires teamIdOrKey.");
  }

  const teamId = await resolveLinearTeamId({
    accessToken: context.auth.accessToken,
    teamIdOrKey,
  });
  const input = buildLinearTeamUpdateInput(args);
  const data = await executeLinearGraphql<{
    teamUpdate?: {
      lastSyncId?: number | null;
      success?: boolean | null;
      team?: LinearTeamNode | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_TEAM_MUTATION,
    variables: {
      id: teamId,
      input,
    },
  });

  return buildLinearTeamCommandResult({
    commandKey: "team.update",
    lastSyncId: data.teamUpdate?.lastSyncId,
    success: data.teamUpdate?.success,
    team: data.teamUpdate?.team,
  });
};
