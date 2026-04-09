import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearDocumentCommandResult,
  executeLinearGraphql,
  getLinearDocumentFields,
  type LinearDocumentNode,
} from "../../client";
import { buildLinearDocumentUpdateInput } from "./input";

const UPDATE_DOCUMENT_MUTATION = `
  mutation OttoLinearDocumentUpdate($id: String!, $input: DocumentUpdateInput!) {
    documentUpdate(id: $id, input: $input) {
      document {
        ${getLinearDocumentFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearDocumentUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const documentId =
    typeof args.documentId === "string" ? args.documentId.trim() : "";

  if (!documentId) {
    throw new Error("linear document.update requires documentId.");
  }

  const input = buildLinearDocumentUpdateInput(args);
  const data = await executeLinearGraphql<{
    documentUpdate?: {
      document?: LinearDocumentNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_DOCUMENT_MUTATION,
    variables: {
      id: documentId,
      input,
    },
  });

  return buildLinearDocumentCommandResult({
    commandKey: "document.update",
    document: data.documentUpdate?.document,
    lastSyncId: data.documentUpdate?.lastSyncId,
    success: data.documentUpdate?.success,
  });
};
