import {
  workspaceJobStatusResponseSchema,
  workspaceIntegrationCapabilityPolicyResponseSchema,
  workspaceIntegrationCapabilityPolicyUpdateSchema,
  workspaceIntegrationDetailSchema,
  workspaceIntegrationDisconnectResponseSchema,
  workspaceIntegrationsResponseSchema,
  workspaceSlackDirectoryResyncResponseSchema,
  workspaceSlackDirectoryResyncSchema,
  workspaceSlackChannelMembershipResponseSchema,
  workspaceSlackChannelMembershipUpdateSchema,
  workspaceSlackSettingsPatchSchema,
  workspaceSlackSettingsUpdateResponseSchema,
  type WorkspaceJobStatusResponse,
  type WorkspaceIntegrationDetail,
} from "@otto/feature-integrations-runtime/workspace"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function workspaceIntegrationsQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"].integrations.$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceIntegrationsResponseSchema.parse(data).integrations,
      )
    },
    queryKey: ["workspace-integrations", orgSlug],
    staleTime: 30_000,
  })
}

export function workspaceIntegrationDetailQueryOptions(input: {
  integrationKey: string
  orgSlug: string
}) {
  return queryOptions({
    queryFn: async (): Promise<WorkspaceIntegrationDetail> => {
      const response =
        await apiClient.api.workspace[":orgSlug"].integrations[":integrationKey"].$get({
          param: {
            integrationKey: input.integrationKey,
            orgSlug: input.orgSlug,
          },
        })

      return fetchApiResponse(response, (data) =>
        workspaceIntegrationDetailSchema.parse(data),
      )
    },
    queryKey: ["workspace-integration-detail", input.orgSlug, input.integrationKey],
    staleTime: 30_000,
  })
}

export async function disconnectWorkspaceIntegration(input: {
  integrationKey: string
  orgSlug: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].integrations[":integrationKey"].disconnect.$post({
      param: {
        integrationKey: input.integrationKey,
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceIntegrationDisconnectResponseSchema.parse(data),
  )
}

export async function updateWorkspaceIntegrationCapabilityPolicy(input: {
  capabilityKey: string
  integrationKey: string
  orgSlug: string
  policy: "allow" | "block"
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].integrations[":integrationKey"].capabilities[
      ":capabilityKey"
    ].policy.$post({
      json: workspaceIntegrationCapabilityPolicyUpdateSchema.parse({
        policy: input.policy,
      }),
      param: {
        capabilityKey: input.capabilityKey,
        integrationKey: input.integrationKey,
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceIntegrationCapabilityPolicyResponseSchema.parse(data),
  )
}

export async function updateWorkspaceSlackSettings(input: {
  allowDestructiveChanges?: boolean
  expectedEntryVersion?: number
  orgSlug: string
  patch: Record<string, unknown>
  summary?: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].integrations[":integrationKey"].settings.$patch({
      json: workspaceSlackSettingsPatchSchema.parse({
        allowDestructiveChanges: input.allowDestructiveChanges,
        expectedEntryVersion: input.expectedEntryVersion,
        patch: input.patch,
        summary: input.summary,
      }),
      param: {
        integrationKey: "slack",
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceSlackSettingsUpdateResponseSchema.parse(data),
  )
}

export async function updateWorkspaceSlackChannelMembership(input: {
  action: "join" | "leave"
  channelId: string
  orgSlug: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].integrations.slack.channels[
      ":channelId"
    ].membership.$post({
      json: workspaceSlackChannelMembershipUpdateSchema.parse({
        action: input.action,
      }),
      param: {
        channelId: input.channelId,
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceSlackChannelMembershipResponseSchema.parse(data),
  )
}

export async function enqueueWorkspaceSlackDirectoryResync(input: {
  action: "channels" | "users"
  orgSlug: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].integrations.slack["resync-directory"].$post({
      json: workspaceSlackDirectoryResyncSchema.parse({
        action: input.action,
      }),
      param: {
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceSlackDirectoryResyncResponseSchema.parse(data),
  )
}

export async function fetchWorkspaceJobStatus(input: {
  jobId: string
  orgSlug: string
}): Promise<WorkspaceJobStatusResponse> {
  const response =
    await apiClient.api.workspace[":orgSlug"].jobs[":jobId"].status.$get({
      param: {
        jobId: input.jobId,
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceJobStatusResponseSchema.parse(data),
  )
}
