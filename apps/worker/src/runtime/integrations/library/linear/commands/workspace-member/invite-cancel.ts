import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
} from "../../client";

const DELETE_WORKSPACE_MEMBER_INVITE_MUTATION = `
  mutation OttoLinearOrganizationInviteDelete($id: String!) {
    organizationInviteDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

export const executeLinearWorkspaceMemberInviteCancel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const inviteId =
      typeof args.inviteId === "string" ? args.inviteId.trim() : "";

    if (!inviteId) {
      throw new Error(
        "linear workspace_member.invite_cancel requires inviteId.",
      );
    }

    const data = await executeLinearGraphql<{
      organizationInviteDelete?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_WORKSPACE_MEMBER_INVITE_MUTATION,
      variables: {
        id: inviteId,
      },
    });

    return {
      ...buildLinearDeleteCommandResult({
        commandKey: "workspace_member.invite_cancel",
        entityId: data.organizationInviteDelete?.entityId,
        entityKey: "InviteId",
        lastSyncId: data.organizationInviteDelete?.lastSyncId,
        success: data.organizationInviteDelete?.success,
      }),
      lookup: inviteId,
    };
  };
