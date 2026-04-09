import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
} from "../../client";

const DELETE_TEAM_MEMBERSHIP_MUTATION = `
  mutation OttoLinearTeamMembershipDelete($alsoLeaveParentTeams: Boolean, $id: String!) {
    teamMembershipDelete(id: $id, alsoLeaveParentTeams: $alsoLeaveParentTeams) {
      entityId
      lastSyncId
      success
    }
  }
`;

export const executeLinearTeamMembersRemove: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const membershipId =
      typeof args.membershipId === "string" ? args.membershipId.trim() : "";

    if (!membershipId) {
      throw new Error("linear team.members_remove requires membershipId.");
    }

    const data = await executeLinearGraphql<{
      teamMembershipDelete?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_TEAM_MEMBERSHIP_MUTATION,
      variables: {
        alsoLeaveParentTeams:
          typeof args.alsoLeaveParentTeams === "boolean"
            ? args.alsoLeaveParentTeams
            : undefined,
        id: membershipId,
      },
    });

    return {
      ...buildLinearDeleteCommandResult({
        commandKey: "team.members_remove",
        entityId: data.teamMembershipDelete?.entityId,
        entityKey: "TeamMembershipId",
        lastSyncId: data.teamMembershipDelete?.lastSyncId,
        success: data.teamMembershipDelete?.success,
      }),
      lookup: membershipId,
    };
  };
