import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearProjectStatusCollectionCommandResult,
  buildLinearProjectStatusCommandResult,
  executeLinearGraphql,
  getLinearProjectStatusFields,
  type LinearProjectStatusNode,
  normalizeLimit,
} from "../../client"
import {
  buildLinearProjectStatusCreateInput,
  buildLinearProjectStatusUpdateInput,
} from "./input"

const LIST_PROJECT_STATUSES_QUERY = `
  query OttoLinearProjectStatusList($limit: Int!) {
    projectStatuses(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearProjectStatusFields()}
      }
    }
  }
`

const GET_PROJECT_STATUS_QUERY = `
  query OttoLinearProjectStatusGet($id: String!) {
    projectStatus(id: $id) {
      ${getLinearProjectStatusFields()}
    }
  }
`

const CREATE_PROJECT_STATUS_MUTATION = `
  mutation OttoLinearProjectStatusCreate($input: ProjectStatusCreateInput!) {
    projectStatusCreate(input: $input) {
      lastSyncId
      status {
        ${getLinearProjectStatusFields()}
      }
      success
    }
  }
`

const UPDATE_PROJECT_STATUS_MUTATION = `
  mutation OttoLinearProjectStatusUpdate($id: String!, $input: ProjectStatusUpdateInput!) {
    projectStatusUpdate(id: $id, input: $input) {
      lastSyncId
      status {
        ${getLinearProjectStatusFields()}
      }
      success
    }
  }
`

export const executeLinearProjectStatusList: IntegrationCommandExecute =
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
      projectStatuses?: {
        nodes?: LinearProjectStatusNode[] | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_STATUSES_QUERY,
      variables: {
        limit,
      },
    })

    return buildLinearProjectStatusCollectionCommandResult({
      commandKey: "project_status.list",
      items: data.projectStatuses?.nodes ?? [],
      limit,
    })
  }

export const executeLinearProjectStatusGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const statusId = typeof args.statusId === "string" ? args.statusId.trim() : ""

  if (!statusId) {
    throw new Error("linear project_status.get requires statusId.")
  }

  const data = await executeLinearGraphql<{
    projectStatus?: LinearProjectStatusNode | null
  }>({
    accessToken: context.auth.accessToken,
    query: GET_PROJECT_STATUS_QUERY,
    variables: {
      id: statusId,
    },
  })

  return {
    ...buildLinearProjectStatusCommandResult({
      commandKey: "project_status.get",
      status: data.projectStatus,
    }),
    lookup: statusId,
  }
}

export const executeLinearProjectStatusCreate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const input = buildLinearProjectStatusCreateInput(args)
    const data = await executeLinearGraphql<{
      projectStatusCreate?: {
        lastSyncId?: number | null
        status?: LinearProjectStatusNode | null
        success?: boolean | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_PROJECT_STATUS_MUTATION,
      variables: {
        input,
      },
    })

    return buildLinearProjectStatusCommandResult({
      commandKey: "project_status.create",
      lastSyncId: data.projectStatusCreate?.lastSyncId,
      status: data.projectStatusCreate?.status,
      success: data.projectStatusCreate?.success,
    })
  }

export const executeLinearProjectStatusUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const statusId =
      typeof args.statusId === "string" ? args.statusId.trim() : ""

    if (!statusId) {
      throw new Error("linear project_status.update requires statusId.")
    }

    const input = buildLinearProjectStatusUpdateInput(args)
    const data = await executeLinearGraphql<{
      projectStatusUpdate?: {
        lastSyncId?: number | null
        status?: LinearProjectStatusNode | null
        success?: boolean | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_PROJECT_STATUS_MUTATION,
      variables: {
        id: statusId,
        input,
      },
    })

    return buildLinearProjectStatusCommandResult({
      commandKey: "project_status.update",
      lastSyncId: data.projectStatusUpdate?.lastSyncId,
      status: data.projectStatusUpdate?.status,
      success: data.projectStatusUpdate?.success,
    })
  }
