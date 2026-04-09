import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearAttachmentCommandResult,
  executeLinearGraphql,
  getLinearAttachmentFields,
  type LinearAttachmentNode,
} from "../../client";
import { buildLinearAttachmentCreateInput } from "./input";

const CREATE_ATTACHMENT_MUTATION = `
  mutation OttoLinearAttachmentCreate($input: AttachmentCreateInput!) {
    attachmentCreate(input: $input) {
      attachment {
        ${getLinearAttachmentFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearAttachmentCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const input = buildLinearAttachmentCreateInput(args);
  const data = await executeLinearGraphql<{
    attachmentCreate?: {
      attachment?: LinearAttachmentNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_ATTACHMENT_MUTATION,
    variables: {
      input,
    },
  });

  return buildLinearAttachmentCommandResult({
    attachment: data.attachmentCreate?.attachment,
    commandKey: "attachment.create",
    lastSyncId: data.attachmentCreate?.lastSyncId,
    success: data.attachmentCreate?.success,
  });
};
