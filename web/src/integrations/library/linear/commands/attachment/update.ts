import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearAttachmentCommandResult,
  executeLinearGraphql,
  getLinearAttachmentFields,
  type LinearAttachmentNode,
} from "../../client";
import { buildLinearAttachmentUpdateInput } from "./input";

const UPDATE_ATTACHMENT_MUTATION = `
  mutation OttoLinearAttachmentUpdate($id: String!, $input: AttachmentUpdateInput!) {
    attachmentUpdate(id: $id, input: $input) {
      attachment {
        ${getLinearAttachmentFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearAttachmentUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const attachmentId =
    typeof args.attachmentId === "string" ? args.attachmentId.trim() : "";

  if (!attachmentId) {
    throw new Error("linear attachment.update requires attachmentId.");
  }

  const input = buildLinearAttachmentUpdateInput(args);
  const data = await executeLinearGraphql<{
    attachmentUpdate?: {
      attachment?: LinearAttachmentNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_ATTACHMENT_MUTATION,
    variables: {
      id: attachmentId,
      input,
    },
  });

  return buildLinearAttachmentCommandResult({
    attachment: data.attachmentUpdate?.attachment,
    commandKey: "attachment.update",
    lastSyncId: data.attachmentUpdate?.lastSyncId,
    success: data.attachmentUpdate?.success,
  });
};
