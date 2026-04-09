import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearTeamCommandResult,
  findLinearTeamByIdOrKey,
} from "../../client";

export const executeLinearTeamGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const teamIdOrKey =
    typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : "";

  if (!teamIdOrKey) {
    throw new Error("linear team.get requires teamIdOrKey.");
  }

  const team = await findLinearTeamByIdOrKey({
    accessToken: context.auth.accessToken,
    teamIdOrKey,
  });

  return {
    ...buildLinearTeamCommandResult({
      commandKey: "team.get",
      team,
    }),
    lookup: teamIdOrKey,
  };
};
