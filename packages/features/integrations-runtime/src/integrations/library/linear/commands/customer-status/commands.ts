import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearCustomerStatusCollectionCommandResult,
  buildLinearCustomerStatusCommandResult,
  buildLinearDeleteCommandResult,
  executeLinearGraphql,
  getLinearCustomerStatusFields,
  type LinearCustomerStatusNode,
  normalizeLimit,
} from "../../client"
import {
  buildLinearCustomerStatusCreateInput,
  buildLinearCustomerStatusUpdateInput,
} from "./input"

const LIST_CUSTOMER_STATUSES_QUERY = `
  query OttoLinearCustomerStatusList($limit: Int!) {
    customerStatuses(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearCustomerStatusFields()}
      }
    }
  }
`

const GET_CUSTOMER_STATUS_QUERY = `
  query OttoLinearCustomerStatusGet($id: String!) {
    customerStatus(id: $id) {
      ${getLinearCustomerStatusFields()}
    }
  }
`

const CREATE_CUSTOMER_STATUS_MUTATION = `
  mutation OttoLinearCustomerStatusCreate($input: CustomerStatusCreateInput!) {
    customerStatusCreate(input: $input) {
      lastSyncId
      status {
        ${getLinearCustomerStatusFields()}
      }
      success
    }
  }
`

const UPDATE_CUSTOMER_STATUS_MUTATION = `
  mutation OttoLinearCustomerStatusUpdate($id: String!, $input: CustomerStatusUpdateInput!) {
    customerStatusUpdate(id: $id, input: $input) {
      lastSyncId
      status {
        ${getLinearCustomerStatusFields()}
      }
      success
    }
  }
`

const DELETE_CUSTOMER_STATUS_MUTATION = `
  mutation OttoLinearCustomerStatusDelete($id: String!) {
    customerStatusDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`

export const executeLinearCustomerStatusList: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    })
    const data = await executeLinearGraphql<{
      customerStatuses?: {
        nodes?: LinearCustomerStatusNode[] | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_CUSTOMER_STATUSES_QUERY,
      variables: { limit },
    })

    return buildLinearCustomerStatusCollectionCommandResult({
      commandKey: "customer_status.list",
      items: data.customerStatuses?.nodes ?? [],
      limit,
    })
  }

export const executeLinearCustomerStatusGet: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const statusId =
      typeof args.statusId === "string" ? args.statusId.trim() : ""

    if (!statusId) {
      throw new Error("linear customer_status.get requires statusId.")
    }

    const data = await executeLinearGraphql<{
      customerStatus?: LinearCustomerStatusNode | null
    }>({
      accessToken: context.auth.accessToken,
      query: GET_CUSTOMER_STATUS_QUERY,
      variables: { id: statusId },
    })

    return {
      ...buildLinearCustomerStatusCommandResult({
        commandKey: "customer_status.get",
        status: data.customerStatus,
      }),
      lookup: statusId,
    }
  }

export const executeLinearCustomerStatusCreate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const input = buildLinearCustomerStatusCreateInput(args)
    const data = await executeLinearGraphql<{
      customerStatusCreate?: {
        lastSyncId?: number | null
        status?: LinearCustomerStatusNode | null
        success?: boolean | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_CUSTOMER_STATUS_MUTATION,
      variables: { input },
    })

    return buildLinearCustomerStatusCommandResult({
      commandKey: "customer_status.create",
      lastSyncId: data.customerStatusCreate?.lastSyncId,
      status: data.customerStatusCreate?.status,
      success: data.customerStatusCreate?.success,
    })
  }

export const executeLinearCustomerStatusUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const statusId =
      typeof args.statusId === "string" ? args.statusId.trim() : ""

    if (!statusId) {
      throw new Error("linear customer_status.update requires statusId.")
    }

    const input = buildLinearCustomerStatusUpdateInput(args)
    const data = await executeLinearGraphql<{
      customerStatusUpdate?: {
        lastSyncId?: number | null
        status?: LinearCustomerStatusNode | null
        success?: boolean | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_CUSTOMER_STATUS_MUTATION,
      variables: { id: statusId, input },
    })

    return buildLinearCustomerStatusCommandResult({
      commandKey: "customer_status.update",
      lastSyncId: data.customerStatusUpdate?.lastSyncId,
      status: data.customerStatusUpdate?.status,
      success: data.customerStatusUpdate?.success,
    })
  }

export const executeLinearCustomerStatusDelete: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const statusId =
      typeof args.statusId === "string" ? args.statusId.trim() : ""

    if (!statusId) {
      throw new Error("linear customer_status.delete requires statusId.")
    }

    const data = await executeLinearGraphql<{
      customerStatusDelete?: {
        entityId?: string | null
        lastSyncId?: number | null
        success?: boolean | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_CUSTOMER_STATUS_MUTATION,
      variables: { id: statusId },
    })

    return buildLinearDeleteCommandResult({
      commandKey: "customer_status.delete",
      entityId: data.customerStatusDelete?.entityId,
      entityKey: "CustomerStatusId",
      lastSyncId: data.customerStatusDelete?.lastSyncId,
      success: data.customerStatusDelete?.success,
    })
  }
