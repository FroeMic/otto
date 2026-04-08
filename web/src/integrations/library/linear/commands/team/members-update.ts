import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearTeamMembershipCommandResult,
  executeLinearGraphql,
  getLinearTeamReferenceFields,
  getLinearUserFields,
  type LinearTeamMembershipNode,
} from "../../client";

const UPDATE_TEAM_MEMBERSHIP_MUTATION = `
  mutation OttoLinearTeamMembershipUpdate($id: String!, $input: TeamMembershipUpdateInput!) {
    teamMembershipUpdate(id: $id, input: $input) {
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

export const executeLinearTeamMembersUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const membershipId =
      typeof args.membershipId === "string" ? args.membershipId.trim() : "";

    if (!membershipId) {
      throw new Error("linear team.members_update requires membershipId.");
    }

    const input: {
      owner?: boolean;
      sortOrder?: number;
    } = {};

    if (typeof args.owner === "boolean") {
      input.owner = args.owner;
    }

    if (typeof args.sortOrder === "number" && Number.isFinite(args.sortOrder)) {
      input.sortOrder = args.sortOrder;
    }

    if (Object.keys(input).length === 0) {
      throw new Error(
        "linear team.members_update requires at least one update field.",
      );
    }

    const data = await executeLinearGraphql<{
      teamMembershipUpdate?: {
        lastSyncId?: number | null;
        success?: boolean | null;
        teamMembership?: LinearTeamMembershipNode | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_TEAM_MEMBERSHIP_MUTATION,
      variables: {
        id: membershipId,
        input,
      },
    });

    return {
      ...buildLinearTeamMembershipCommandResult({
        commandKey: "team.members_update",
        lastSyncId: data.teamMembershipUpdate?.lastSyncId,
        success: data.teamMembershipUpdate?.success,
        teamMembership: data.teamMembershipUpdate?.teamMembership,
      }),
      lookup: membershipId,
    };
  };
