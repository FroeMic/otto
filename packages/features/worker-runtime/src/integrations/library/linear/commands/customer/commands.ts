import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearCustomerCollectionCommandResult,
  buildLinearCustomerCommandResult,
  buildLinearCustomerNeedChildCollectionCommandResult,
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
  getLinearCustomerFields,
  getLinearCustomerNeedFields,
  type LinearCustomerNeedNode,
  type LinearCustomerNode,
  normalizeLimit,
} from "../../client";
import {
  buildLinearCustomerCreateInput,
  buildLinearCustomerUpdateInput,
} from "./input";

const LIST_CUSTOMERS_QUERY = `
  query OttoLinearCustomerList($limit: Int!) {
    customers(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearCustomerFields()}
      }
    }
  }
`;

const GET_CUSTOMER_QUERY = `
  query OttoLinearCustomerGet($id: String!) {
    customer(id: $id) {
      ${getLinearCustomerFields()}
    }
  }
`;

const CREATE_CUSTOMER_MUTATION = `
  mutation OttoLinearCustomerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        ${getLinearCustomerFields()}
      }
      lastSyncId
      success
    }
  }
`;

const UPDATE_CUSTOMER_MUTATION = `
  mutation OttoLinearCustomerUpdate($id: String!, $input: CustomerUpdateInput!) {
    customerUpdate(id: $id, input: $input) {
      customer {
        ${getLinearCustomerFields()}
      }
      lastSyncId
      success
    }
  }
`;

const DELETE_CUSTOMER_MUTATION = `
  mutation OttoLinearCustomerDelete($id: String!) {
    customerDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

const LIST_CUSTOMER_NEEDS_QUERY = `
  query OttoLinearCustomerListNeeds($id: String!) {
    customer(id: $id) {
      ${getLinearCustomerFields()}
      needs {
        ${getLinearCustomerNeedFields()}
      }
    }
  }
`;

export const executeLinearCustomerList: IntegrationCommandExecute = async ({
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
    customers?: {
      nodes?: LinearCustomerNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_CUSTOMERS_QUERY,
    variables: { limit },
  });

  return buildLinearCustomerCollectionCommandResult({
    commandKey: "customer.list",
    items: data.customers?.nodes ?? [],
    limit,
  });
};

export const executeLinearCustomerGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const customerId =
    typeof args.customerId === "string" ? args.customerId.trim() : "";

  if (!customerId) {
    throw new Error("linear customer.get requires customerId.");
  }

  const data = await executeLinearGraphql<{
    customer?: LinearCustomerNode | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_CUSTOMER_QUERY,
    variables: { id: customerId },
  });

  return {
    ...buildLinearCustomerCommandResult({
      commandKey: "customer.get",
      customer: data.customer,
    }),
    lookup: customerId,
  };
};

export const executeLinearCustomerCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const input = buildLinearCustomerCreateInput(args);
  const data = await executeLinearGraphql<{
    customerCreate?: {
      customer?: LinearCustomerNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_CUSTOMER_MUTATION,
    variables: { input },
  });

  return buildLinearCustomerCommandResult({
    commandKey: "customer.create",
    customer: data.customerCreate?.customer,
    lastSyncId: data.customerCreate?.lastSyncId,
    success: data.customerCreate?.success,
  });
};

export const executeLinearCustomerUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const customerId =
    typeof args.customerId === "string" ? args.customerId.trim() : "";

  if (!customerId) {
    throw new Error("linear customer.update requires customerId.");
  }

  const input = buildLinearCustomerUpdateInput(args);
  const data = await executeLinearGraphql<{
    customerUpdate?: {
      customer?: LinearCustomerNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_CUSTOMER_MUTATION,
    variables: { id: customerId, input },
  });

  return buildLinearCustomerCommandResult({
    commandKey: "customer.update",
    customer: data.customerUpdate?.customer,
    lastSyncId: data.customerUpdate?.lastSyncId,
    success: data.customerUpdate?.success,
  });
};

export const executeLinearCustomerDelete: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const customerId =
    typeof args.customerId === "string" ? args.customerId.trim() : "";

  if (!customerId) {
    throw new Error("linear customer.delete requires customerId.");
  }

  const data = await executeLinearGraphql<{
    customerDelete?: {
      entityId?: string | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: DELETE_CUSTOMER_MUTATION,
    variables: { id: customerId },
  });

  return {
    ...buildLinearDeleteCommandResult({
      commandKey: "customer.delete",
      entityId: data.customerDelete?.entityId,
      entityKey: "CustomerId",
      lastSyncId: data.customerDelete?.lastSyncId,
      success: data.customerDelete?.success,
    }),
    lookup: customerId,
  };
};

export const executeLinearCustomerListNeeds: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const customerId =
      typeof args.customerId === "string" ? args.customerId.trim() : "";

    if (!customerId) {
      throw new Error("linear customer.list_needs requires customerId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      customer?:
        | (LinearCustomerNode & {
            needs?: LinearCustomerNeedNode[] | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_CUSTOMER_NEEDS_QUERY,
      variables: { id: customerId },
    });

    if (!data.customer) {
      throw new Error("Linear returned no customer for customer.list_needs.");
    }

    return {
      ...buildLinearCustomerNeedChildCollectionCommandResult({
        commandKey: "customer.list_needs",
        customer: data.customer,
        items: (data.customer.needs ?? []).slice(0, limit),
        limit,
      }),
      lookup: customerId,
    };
  };
