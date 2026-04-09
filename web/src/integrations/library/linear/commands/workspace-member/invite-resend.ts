import type { IntegrationCommandExecute } from "@/integrations/framework";

import { executeLinearGraphql } from "../../client";

const RESEND_WORKSPACE_MEMBER_INVITE_BY_ID_MUTATION = `
  mutation OttoLinearResendOrganizationInvite($id: String!) {
    resendOrganizationInvite(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

const RESEND_WORKSPACE_MEMBER_INVITE_BY_EMAIL_MUTATION = `
  mutation OttoLinearResendOrganizationInviteByEmail($email: String!) {
    resendOrganizationInviteByEmail(email: $email) {
      entityId
      lastSyncId
      success
    }
  }
`;

export const executeLinearWorkspaceMemberInviteResend: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const inviteId =
      typeof args.inviteId === "string" ? args.inviteId.trim() : "";
    const email = typeof args.email === "string" ? args.email.trim() : "";

    if (!inviteId && !email) {
      throw new Error(
        "linear workspace_member.invite_resend requires inviteId or email.",
      );
    }

    if (inviteId) {
      const data = await executeLinearGraphql<{
        resendOrganizationInvite?: {
          entityId?: string | null;
          lastSyncId?: number | null;
          success?: boolean | null;
        } | null;
      }>({
        accessToken: context.auth.accessToken,
        query: RESEND_WORKSPACE_MEMBER_INVITE_BY_ID_MUTATION,
        variables: {
          id: inviteId,
        },
      });

      return {
        commandKey: "workspace_member.invite_resend",
        integrationKey: "linear",
        lastSyncId:
          typeof data.resendOrganizationInvite?.lastSyncId === "number"
            ? data.resendOrganizationInvite.lastSyncId
            : null,
        lookup: inviteId,
        resentInviteId: data.resendOrganizationInvite?.entityId?.trim() || null,
        source: "linear",
        success: data.resendOrganizationInvite?.success ?? true,
      };
    }

    const data = await executeLinearGraphql<{
      resendOrganizationInviteByEmail?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: RESEND_WORKSPACE_MEMBER_INVITE_BY_EMAIL_MUTATION,
      variables: {
        email,
      },
    });

    return {
      commandKey: "workspace_member.invite_resend",
      integrationKey: "linear",
      lastSyncId:
        typeof data.resendOrganizationInviteByEmail?.lastSyncId === "number"
          ? data.resendOrganizationInviteByEmail.lastSyncId
          : null,
      lookup: email,
      resentInviteId:
        data.resendOrganizationInviteByEmail?.entityId?.trim() || null,
      source: "linear",
      success: data.resendOrganizationInviteByEmail?.success ?? true,
    };
  };
