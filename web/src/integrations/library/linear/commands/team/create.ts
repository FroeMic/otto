import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearTeamCommandResult,
  executeLinearGraphql,
  getLinearTeamFields,
  type LinearTeamNode,
} from "../../client";
import { buildLinearTeamCreateInput } from "./input";

const CREATE_TEAM_MUTATION = `
  mutation OttoLinearTeamCreate($input: TeamCreateInput!) {
    teamCreate(input: $input) {
      lastSyncId
      success
      team {
        ${getLinearTeamFields()}
      }
    }
  }
`;

export const executeLinearTeamCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const input = buildLinearTeamCreateInput(args);
  const data = await executeLinearGraphql<{
    teamCreate?: {
      lastSyncId?: number | null;
      success?: boolean | null;
      team?: LinearTeamNode | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_TEAM_MUTATION,
    variables: {
      input,
    },
  });

  return buildLinearTeamCommandResult({
    commandKey: "team.create",
    lastSyncId: data.teamCreate?.lastSyncId,
    success: data.teamCreate?.success,
    team: data.teamCreate?.team,
  });
};
