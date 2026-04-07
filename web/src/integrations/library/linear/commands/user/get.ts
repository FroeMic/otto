import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearUserCommandResult,
  executeLinearGraphql,
  getLinearUserFields,
  type LinearUserNode,
} from "../../client";

const GET_USER_QUERY = `
  query OttoLinearUserGet($id: String!) {
    user(id: $id) {
      ${getLinearUserFields()}
    }
  }
`;

export const executeLinearUserGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const userId = typeof args.userId === "string" ? args.userId.trim() : "";

  if (!userId) {
    throw new Error("linear user.get requires userId.");
  }

  const data = await executeLinearGraphql<{
    user?: LinearUserNode | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_USER_QUERY,
    variables: {
      id: userId,
    },
  });

  return {
    ...buildLinearUserCommandResult({
      commandKey: "user.get",
      user: data.user,
    }),
    lookup: userId,
  };
};
