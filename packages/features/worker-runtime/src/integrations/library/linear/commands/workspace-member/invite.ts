import type { IntegrationCommandExecute } from "../../../../framework";

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

const CREATE_WORKSPACE_MEMBER_INVITE_MUTATION = `
  mutation OttoLinearOrganizationInviteCreate($input: OrganizationInviteCreateInput!) {
    organizationInviteCreate(input: $input) {
      lastSyncId
      success
      organizationInvite {
        ${ORGANIZATION_INVITE_FIELDS}
      }
    }
  }
`;

export const executeLinearWorkspaceMemberInvite: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const email = typeof args.email === "string" ? args.email.trim() : "";

    if (!email) {
      throw new Error("linear workspace_member.invite requires email.");
    }

    const input: {
      email: string;
      role?: string;
      teamIds?: string[];
    } = {
      email,
    };

    if (typeof args.role === "string" && args.role.trim()) {
      input.role = args.role.trim();
    }

    if (Array.isArray(args.teamIds)) {
      const teamIds = args.teamIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      if (teamIds.length > 0) {
        input.teamIds = teamIds;
      }
    }

    const data = await executeLinearGraphql<{
      organizationInviteCreate?: {
        lastSyncId?: number | null;
        organizationInvite?: LinearOrganizationInviteNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_WORKSPACE_MEMBER_INVITE_MUTATION,
      variables: {
        input,
      },
    });

    return {
      ...buildLinearOrganizationInviteCommandResult({
        commandKey: "workspace_member.invite",
        invite: data.organizationInviteCreate?.organizationInvite,
        lastSyncId: data.organizationInviteCreate?.lastSyncId,
        success: data.organizationInviteCreate?.success,
      }),
      lookup: email,
    };
  };
