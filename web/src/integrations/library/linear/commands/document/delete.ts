import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
} from "../../client";

const DELETE_DOCUMENT_MUTATION = `
  mutation OttoLinearDocumentDelete($id: String!) {
    documentDelete(id: $id) {
      entity {
        id
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearDocumentDelete: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const documentId =
    typeof args.documentId === "string" ? args.documentId.trim() : "";

  if (!documentId) {
    throw new Error("linear document.delete requires documentId.");
  }

  const data = await executeLinearGraphql<{
    documentDelete?: {
      entity?: {
        id?: string | null;
      } | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: DELETE_DOCUMENT_MUTATION,
    variables: {
      id: documentId,
    },
  });

  return {
    ...buildLinearDeleteCommandResult({
      commandKey: "document.delete",
      entityId: data.documentDelete?.entity?.id,
      entityKey: "DocumentId",
      lastSyncId: data.documentDelete?.lastSyncId,
      success: data.documentDelete?.success,
    }),
    lookup: documentId,
  };
};
