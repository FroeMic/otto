import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearUserCommandResult,
  executeLinearGraphql,
  getLinearUserFields,
  type LinearUserNode,
} from "../../client";

const UPDATE_WORKSPACE_MEMBER_MUTATION = `
  mutation OttoLinearUserUpdate($id: String!, $input: UserUpdateInput!) {
    userUpdate(id: $id, input: $input) {
      lastSyncId
      success
      user {
        ${getLinearUserFields()}
      }
    }
  }
`;

export const executeLinearWorkspaceMemberUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const userId = typeof args.userId === "string" ? args.userId.trim() : "";

    if (!userId) {
      throw new Error("linear workspace_member.update requires userId.");
    }

    const input: {
      avatarUrl?: string;
      description?: string;
      displayName?: string;
      name?: string;
      statusEmoji?: string;
      statusLabel?: string;
      statusUntilAt?: string;
      timezone?: string;
    } = {};

    if (typeof args.avatarUrl === "string" && args.avatarUrl.trim()) {
      input.avatarUrl = args.avatarUrl.trim();
    }

    if (typeof args.description === "string" && args.description.trim()) {
      input.description = args.description.trim();
    }

    if (typeof args.displayName === "string" && args.displayName.trim()) {
      input.displayName = args.displayName.trim();
    }

    if (typeof args.name === "string" && args.name.trim()) {
      input.name = args.name.trim();
    }

    if (typeof args.statusEmoji === "string" && args.statusEmoji.trim()) {
      input.statusEmoji = args.statusEmoji.trim();
    }

    if (typeof args.statusLabel === "string" && args.statusLabel.trim()) {
      input.statusLabel = args.statusLabel.trim();
    }

    if (typeof args.statusUntilAt === "string" && args.statusUntilAt.trim()) {
      input.statusUntilAt = args.statusUntilAt.trim();
    }

    if (typeof args.timezone === "string" && args.timezone.trim()) {
      input.timezone = args.timezone.trim();
    }

    if (Object.keys(input).length === 0) {
      throw new Error(
        "linear workspace_member.update requires at least one update field.",
      );
    }

    const data = await executeLinearGraphql<{
      userUpdate?: {
        lastSyncId?: number | null;
        success?: boolean | null;
        user?: LinearUserNode | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_WORKSPACE_MEMBER_MUTATION,
      variables: {
        id: userId,
        input,
      },
    });

    return {
      ...buildLinearUserCommandResult({
        commandKey: "workspace_member.update",
        lastSyncId: data.userUpdate?.lastSyncId,
        success: data.userUpdate?.success,
        user: data.userUpdate?.user,
      }),
      lookup: userId,
    };
  };
