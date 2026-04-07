import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearCustomerNeedCollectionCommandResult,
  buildLinearCustomerNeedCommandResult,
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
  getLinearCustomerNeedFields,
  type LinearCustomerNeedNode,
  normalizeLimit,
} from "../../client";
import {
  buildLinearCustomerNeedCreateFromAttachmentInput,
  buildLinearCustomerNeedCreateInput,
  buildLinearCustomerNeedUpdateInput,
} from "./input";

const LIST_CUSTOMER_NEEDS_QUERY = `
  query OttoLinearCustomerNeedList($includeArchived: Boolean, $limit: Int!) {
    customerNeeds(first: $limit, includeArchived: $includeArchived, orderBy: updatedAt) {
      nodes {
        ${getLinearCustomerNeedFields()}
      }
    }
  }
`;

const GET_CUSTOMER_NEED_QUERY = `
  query OttoLinearCustomerNeedGet($id: String!) {
    customerNeed(id: $id) {
      ${getLinearCustomerNeedFields()}
    }
  }
`;

const CREATE_CUSTOMER_NEED_MUTATION = `
  mutation OttoLinearCustomerNeedCreate($input: CustomerNeedCreateInput!) {
    customerNeedCreate(input: $input) {
      lastSyncId
      need {
        ${getLinearCustomerNeedFields()}
      }
      success
    }
  }
`;

const CREATE_CUSTOMER_NEED_FROM_ATTACHMENT_MUTATION = `
  mutation OttoLinearCustomerNeedCreateFromAttachment($input: CustomerNeedCreateFromAttachmentInput!) {
    customerNeedCreateFromAttachment(input: $input) {
      lastSyncId
      need {
        ${getLinearCustomerNeedFields()}
      }
      success
    }
  }
`;

const UPDATE_CUSTOMER_NEED_MUTATION = `
  mutation OttoLinearCustomerNeedUpdate($clearAttachment: Boolean, $id: String!, $input: CustomerNeedUpdateInput!) {
    customerNeedUpdate(clearAttachment: $clearAttachment, id: $id, input: $input) {
      lastSyncId
      need {
        ${getLinearCustomerNeedFields()}
      }
      success
      updatedRelatedNeeds {
        ${getLinearCustomerNeedFields()}
      }
    }
  }
`;

const ARCHIVE_CUSTOMER_NEED_MUTATION = `
  mutation OttoLinearCustomerNeedArchive($id: String!) {
    customerNeedArchive(id: $id) {
      entity {
        ${getLinearCustomerNeedFields()}
      }
      lastSyncId
      success
    }
  }
`;

const UNARCHIVE_CUSTOMER_NEED_MUTATION = `
  mutation OttoLinearCustomerNeedUnarchive($id: String!) {
    customerNeedUnarchive(id: $id) {
      entity {
        ${getLinearCustomerNeedFields()}
      }
      lastSyncId
      success
    }
  }
`;

const DELETE_CUSTOMER_NEED_MUTATION = `
  mutation OttoLinearCustomerNeedDelete($id: String!, $keepAttachment: Boolean) {
    customerNeedDelete(id: $id, keepAttachment: $keepAttachment) {
      entityId
      lastSyncId
      success
    }
  }
`;

export const executeLinearCustomerNeedList: IntegrationCommandExecute = async ({
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
  const includeArchived =
    typeof args.includeArchived === "boolean" ? args.includeArchived : false;
  const data = await executeLinearGraphql<{
    customerNeeds?: {
      nodes?: LinearCustomerNeedNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_CUSTOMER_NEEDS_QUERY,
    variables: { includeArchived, limit },
  });

  return {
    ...buildLinearCustomerNeedCollectionCommandResult({
      commandKey: "customer_need.list",
      items: data.customerNeeds?.nodes ?? [],
      limit,
    }),
    includeArchived,
  };
};

export const executeLinearCustomerNeedGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const needId = typeof args.needId === "string" ? args.needId.trim() : "";

  if (!needId) {
    throw new Error("linear customer_need.get requires needId.");
  }

  const data = await executeLinearGraphql<{
    customerNeed?: LinearCustomerNeedNode | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_CUSTOMER_NEED_QUERY,
    variables: { id: needId },
  });

  return {
    ...buildLinearCustomerNeedCommandResult({
      commandKey: "customer_need.get",
      need: data.customerNeed,
    }),
    lookup: needId,
  };
};

export const executeLinearCustomerNeedCreate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const input = buildLinearCustomerNeedCreateInput(args);
    const data = await executeLinearGraphql<{
      customerNeedCreate?: {
        lastSyncId?: number | null;
        need?: LinearCustomerNeedNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_CUSTOMER_NEED_MUTATION,
      variables: { input },
    });

    return buildLinearCustomerNeedCommandResult({
      commandKey: "customer_need.create",
      lastSyncId: data.customerNeedCreate?.lastSyncId,
      need: data.customerNeedCreate?.need,
      success: data.customerNeedCreate?.success,
    });
  };

export const executeLinearCustomerNeedCreateFromAttachment: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const input = buildLinearCustomerNeedCreateFromAttachmentInput(args);
    const data = await executeLinearGraphql<{
      customerNeedCreateFromAttachment?: {
        lastSyncId?: number | null;
        need?: LinearCustomerNeedNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_CUSTOMER_NEED_FROM_ATTACHMENT_MUTATION,
      variables: { input },
    });

    return buildLinearCustomerNeedCommandResult({
      commandKey: "customer_need.create_from_attachment",
      lastSyncId: data.customerNeedCreateFromAttachment?.lastSyncId,
      need: data.customerNeedCreateFromAttachment?.need,
      success: data.customerNeedCreateFromAttachment?.success,
    });
  };

export const executeLinearCustomerNeedUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const needId = typeof args.needId === "string" ? args.needId.trim() : "";

    if (!needId) {
      throw new Error("linear customer_need.update requires needId.");
    }

    const clearAttachment =
      typeof args.clearAttachment === "boolean" ? args.clearAttachment : null;
    const input = buildLinearCustomerNeedUpdateInput(args);
    const data = await executeLinearGraphql<{
      customerNeedUpdate?: {
        lastSyncId?: number | null;
        need?: LinearCustomerNeedNode | null;
        success?: boolean | null;
        updatedRelatedNeeds?: LinearCustomerNeedNode[] | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_CUSTOMER_NEED_MUTATION,
      variables: { clearAttachment, id: needId, input },
    });

    return buildLinearCustomerNeedCommandResult({
      commandKey: "customer_need.update",
      lastSyncId: data.customerNeedUpdate?.lastSyncId,
      need: data.customerNeedUpdate?.need,
      success: data.customerNeedUpdate?.success,
      updatedRelatedNeeds: data.customerNeedUpdate?.updatedRelatedNeeds,
    });
  };

export const executeLinearCustomerNeedArchive: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const needId = typeof args.needId === "string" ? args.needId.trim() : "";

    if (!needId) {
      throw new Error("linear customer_need.archive requires needId.");
    }

    const data = await executeLinearGraphql<{
      customerNeedArchive?: {
        entity?: LinearCustomerNeedNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: ARCHIVE_CUSTOMER_NEED_MUTATION,
      variables: { id: needId },
    });

    return buildLinearCustomerNeedCommandResult({
      commandKey: "customer_need.archive",
      lastSyncId: data.customerNeedArchive?.lastSyncId,
      need: data.customerNeedArchive?.entity,
      success: data.customerNeedArchive?.success,
    });
  };

export const executeLinearCustomerNeedUnarchive: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const needId = typeof args.needId === "string" ? args.needId.trim() : "";

    if (!needId) {
      throw new Error("linear customer_need.unarchive requires needId.");
    }

    const data = await executeLinearGraphql<{
      customerNeedUnarchive?: {
        entity?: LinearCustomerNeedNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UNARCHIVE_CUSTOMER_NEED_MUTATION,
      variables: { id: needId },
    });

    return buildLinearCustomerNeedCommandResult({
      commandKey: "customer_need.unarchive",
      lastSyncId: data.customerNeedUnarchive?.lastSyncId,
      need: data.customerNeedUnarchive?.entity,
      success: data.customerNeedUnarchive?.success,
    });
  };

export const executeLinearCustomerNeedDelete: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const needId = typeof args.needId === "string" ? args.needId.trim() : "";

    if (!needId) {
      throw new Error("linear customer_need.delete requires needId.");
    }

    const keepAttachment =
      typeof args.keepAttachment === "boolean" ? args.keepAttachment : null;
    const data = await executeLinearGraphql<{
      customerNeedDelete?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_CUSTOMER_NEED_MUTATION,
      variables: { id: needId, keepAttachment },
    });

    return buildLinearDeleteCommandResult({
      commandKey: "customer_need.delete",
      entityId: data.customerNeedDelete?.entityId,
      entityKey: "CustomerNeedId",
      lastSyncId: data.customerNeedDelete?.lastSyncId,
      success: data.customerNeedDelete?.success,
    });
  };
