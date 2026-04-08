import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearTeamMembershipCommandResult,
  executeLinearGraphql,
  getLinearTeamReferenceFields,
  getLinearUserFields,
  type LinearTeamMembershipNode,
  resolveLinearTeamId,
} from "../../client";

const CREATE_TEAM_MEMBERSHIP_MUTATION = `
  mutation OttoLinearTeamMembershipCreate($input: TeamMembershipCreateInput!) {
    teamMembershipCreate(input: $input) {
      lastSyncId
      success
      teamMembership {
        id
        owner
        sortOrder
        createdAt
        updatedAt
        team {
          ${getLinearTeamReferenceFields()}
        }
        user {
          ${getLinearUserFields()}
        }
      }
    }
  }
`;

export const executeLinearTeamMembersAdd: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const teamIdOrKey =
    typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : "";
  const userId = typeof args.userId === "string" ? args.userId.trim() : "";

  if (!teamIdOrKey) {
    throw new Error("linear team.members_add requires teamIdOrKey.");
  }

  if (!userId) {
    throw new Error("linear team.members_add requires userId.");
  }

  const teamId = await resolveLinearTeamId({
    accessToken: context.auth.accessToken,
    teamIdOrKey,
  });

  const input: {
    owner?: boolean;
    sortOrder?: number;
    teamId: string;
    userId: string;
  } = {
    teamId,
    userId,
  };

  if (typeof args.owner === "boolean") {
    input.owner = args.owner;
  }

  if (typeof args.sortOrder === "number" && Number.isFinite(args.sortOrder)) {
    input.sortOrder = args.sortOrder;
  }

  const data = await executeLinearGraphql<{
    teamMembershipCreate?: {
      lastSyncId?: number | null;
      success?: boolean | null;
      teamMembership?: LinearTeamMembershipNode | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_TEAM_MEMBERSHIP_MUTATION,
    variables: {
      input,
    },
  });

  return {
    ...buildLinearTeamMembershipCommandResult({
      commandKey: "team.members_add",
      lastSyncId: data.teamMembershipCreate?.lastSyncId,
      success: data.teamMembershipCreate?.success,
      teamMembership: data.teamMembershipCreate?.teamMembership,
    }),
    lookup: teamIdOrKey,
  };
};
