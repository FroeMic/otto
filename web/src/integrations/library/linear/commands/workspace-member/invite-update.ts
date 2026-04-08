import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearOrganizationInviteCommandResult,
  executeLinearGraphql,
  getLinearUserFields,
  type LinearOrganizationInviteNode,
} from "../../client";

const ORGANIZATION_INVITE_FIELDS = `
  acceptedAt
  archivedAt
  createdAt
  email
  expiresAt
  external
  id
  invitee {
    ${getLinearUserFields()}
  }
  inviter {
    ${getLinearUserFields()}
  }
  role
  updatedAt
`;

const UPDATE_WORKSPACE_MEMBER_INVITE_MUTATION = `
  mutation OttoLinearOrganizationInviteUpdate($id: String!, $input: OrganizationInviteUpdateInput!) {
    organizationInviteUpdate(id: $id, input: $input) {
      lastSyncId
      success
      organizationInvite {
        ${ORGANIZATION_INVITE_FIELDS}
      }
    }
  }
`;

export const executeLinearWorkspaceMemberInviteUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const inviteId =
      typeof args.inviteId === "string" ? args.inviteId.trim() : "";

    if (!inviteId) {
      throw new Error(
        "linear workspace_member.invite_update requires inviteId.",
      );
    }

    const teamIds = Array.isArray(args.teamIds)
      ? args.teamIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];

    if (teamIds.length === 0) {
      throw new Error(
        "linear workspace_member.invite_update requires at least one teamId.",
      );
    }

    const data = await executeLinearGraphql<{
      organizationInviteUpdate?: {
        lastSyncId?: number | null;
        organizationInvite?: LinearOrganizationInviteNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_WORKSPACE_MEMBER_INVITE_MUTATION,
      variables: {
        id: inviteId,
        input: {
          teamIds,
        },
      },
    });

    return {
      ...buildLinearOrganizationInviteCommandResult({
        commandKey: "workspace_member.invite_update",
        invite: data.organizationInviteUpdate?.organizationInvite,
        lastSyncId: data.organizationInviteUpdate?.lastSyncId,
        success: data.organizationInviteUpdate?.success,
      }),
      lookup: inviteId,
    };
  };
