import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearAttachmentCollectionCommandResult,
  executeLinearGraphql,
  getLinearAttachmentFields,
  type LinearAttachmentNode,
  normalizeLimit,
} from "../../client";

const LIST_ATTACHMENTS_QUERY = `
  query OttoLinearAttachmentList($limit: Int!) {
    attachments(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearAttachmentFields()}
      }
    }
  }
`;

export const executeLinearAttachmentList: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const limit = normalizeLimit({
    defaultLimit: 25,
    max: 100,
    value: args.limit,
  });

  const data = await executeLinearGraphql<{
    attachments?: {
      nodes?: LinearAttachmentNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_ATTACHMENTS_QUERY,
    variables: {
      limit,
    },
  });

  return buildLinearAttachmentCollectionCommandResult({
    commandKey: "attachment.list",
    items: data.attachments?.nodes ?? [],
    limit,
  });
};
