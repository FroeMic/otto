import type { IntegrationCommandExecute } from "@/integrations/framework";

import { executeLinearGraphql, normalizeLimit } from "../../client";

const LIST_USERS_QUERY = `
  query OttoLinearListUsers($limit: Int!) {
    users(first: $limit) {
      nodes {
        id
        name
        displayName
        email
        active
        admin
      }
    }
  }
`;

export const executeLinearWorkspaceListUsers: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      users?: {
        nodes?: Array<{
          active?: boolean | null;
          admin?: boolean | null;
          displayName?: string | null;
          email?: string | null;
          id: string;
          name?: string | null;
        }> | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_USERS_QUERY,
      variables: {
        limit,
      },
    });

    return {
      commandKey: "workspace.list_users",
      integrationKey: "linear",
      items: (data.users?.nodes ?? []).map((user) => ({
        active: Boolean(user.active),
        admin: Boolean(user.admin),
        displayName: user.displayName?.trim() || null,
        email: user.email?.trim() || null,
        id: user.id,
        name:
          user.name?.trim() ||
          user.displayName?.trim() ||
          user.email?.trim() ||
          "Unknown user",
      })),
      limit,
      source: "linear",
    };
  };
