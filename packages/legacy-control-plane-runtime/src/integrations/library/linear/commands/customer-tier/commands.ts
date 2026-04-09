import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearCustomerTierCollectionCommandResult,
  buildLinearCustomerTierCommandResult,
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
  getLinearCustomerTierFields,
  type LinearCustomerTierNode,
  normalizeLimit,
} from "../../client";
import {
  buildLinearCustomerTierCreateInput,
  buildLinearCustomerTierUpdateInput,
} from "./input";

const LIST_CUSTOMER_TIERS_QUERY = `
  query OttoLinearCustomerTierList($limit: Int!) {
    customerTiers(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearCustomerTierFields()}
      }
    }
  }
`;

const GET_CUSTOMER_TIER_QUERY = `
  query OttoLinearCustomerTierGet($id: String!) {
    customerTier(id: $id) {
      ${getLinearCustomerTierFields()}
    }
  }
`;

const CREATE_CUSTOMER_TIER_MUTATION = `
  mutation OttoLinearCustomerTierCreate($input: CustomerTierCreateInput!) {
    customerTierCreate(input: $input) {
      lastSyncId
      success
      tier {
        ${getLinearCustomerTierFields()}
      }
    }
  }
`;

const UPDATE_CUSTOMER_TIER_MUTATION = `
  mutation OttoLinearCustomerTierUpdate($id: String!, $input: CustomerTierUpdateInput!) {
    customerTierUpdate(id: $id, input: $input) {
      lastSyncId
      success
      tier {
        ${getLinearCustomerTierFields()}
      }
    }
  }
`;

const DELETE_CUSTOMER_TIER_MUTATION = `
  mutation OttoLinearCustomerTierDelete($id: String!) {
    customerTierDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

export const executeLinearCustomerTierList: IntegrationCommandExecute = async ({
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
    customerTiers?: {
      nodes?: LinearCustomerTierNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_CUSTOMER_TIERS_QUERY,
    variables: { limit },
  });

  return buildLinearCustomerTierCollectionCommandResult({
    commandKey: "customer_tier.list",
    items: data.customerTiers?.nodes ?? [],
    limit,
  });
};

export const executeLinearCustomerTierGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const tierId = typeof args.tierId === "string" ? args.tierId.trim() : "";

  if (!tierId) {
    throw new Error("linear customer_tier.get requires tierId.");
  }

  const data = await executeLinearGraphql<{
    customerTier?: LinearCustomerTierNode | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_CUSTOMER_TIER_QUERY,
    variables: { id: tierId },
  });

  return {
    ...buildLinearCustomerTierCommandResult({
      commandKey: "customer_tier.get",
      tier: data.customerTier,
    }),
    lookup: tierId,
  };
};

export const executeLinearCustomerTierCreate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const input = buildLinearCustomerTierCreateInput(args);
    const data = await executeLinearGraphql<{
      customerTierCreate?: {
        lastSyncId?: number | null;
        success?: boolean | null;
        tier?: LinearCustomerTierNode | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_CUSTOMER_TIER_MUTATION,
      variables: { input },
    });

    return buildLinearCustomerTierCommandResult({
      commandKey: "customer_tier.create",
      lastSyncId: data.customerTierCreate?.lastSyncId,
      success: data.customerTierCreate?.success,
      tier: data.customerTierCreate?.tier,
    });
  };

export const executeLinearCustomerTierUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const tierId = typeof args.tierId === "string" ? args.tierId.trim() : "";

    if (!tierId) {
      throw new Error("linear customer_tier.update requires tierId.");
    }

    const input = buildLinearCustomerTierUpdateInput(args);
    const data = await executeLinearGraphql<{
      customerTierUpdate?: {
        lastSyncId?: number | null;
        success?: boolean | null;
        tier?: LinearCustomerTierNode | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_CUSTOMER_TIER_MUTATION,
      variables: { id: tierId, input },
    });

    return buildLinearCustomerTierCommandResult({
      commandKey: "customer_tier.update",
      lastSyncId: data.customerTierUpdate?.lastSyncId,
      success: data.customerTierUpdate?.success,
      tier: data.customerTierUpdate?.tier,
    });
  };

export const executeLinearCustomerTierDelete: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const tierId = typeof args.tierId === "string" ? args.tierId.trim() : "";

    if (!tierId) {
      throw new Error("linear customer_tier.delete requires tierId.");
    }

    const data = await executeLinearGraphql<{
      customerTierDelete?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_CUSTOMER_TIER_MUTATION,
      variables: { id: tierId },
    });

    return buildLinearDeleteCommandResult({
      commandKey: "customer_tier.delete",
      entityId: data.customerTierDelete?.entityId,
      entityKey: "CustomerTierId",
      lastSyncId: data.customerTierDelete?.lastSyncId,
      success: data.customerTierDelete?.success,
    });
  };
