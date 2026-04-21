import {
  platformAddCurrentUserAdminResponseSchema,
  platformActionResponseSchema,
  platformBootstrapSchema,
  platformCreateOrganizationResponseSchema,
  platformCreateOrganizationSchema,
  platformDeleteTenantServerResponseSchema,
  platformDeleteWorkspaceResponseSchema,
  platformGrantCreditsResponseSchema,
  platformGrantCreditsSchema,
  platformJobCancelResponseSchema,
  platformJobStatusResponseSchema,
  platformOrganizationDetailResponseSchema,
  platformOrganizationsResponseSchema,
  platformProvisionServerResponseSchema,
  platformProvisionServerSchema,
  platformProvisionOpenAiKeyResponseSchema,
  platformUsageSchema,
  type PlatformBootstrap,
  type PlatformAddCurrentUserAdminResponse,
  type PlatformCreateOrganizationInput,
  type PlatformCreateOrganizationResponse,
  type PlatformDeleteTenantServerResponse,
  type PlatformDeleteWorkspaceResponse,
  type PlatformGrantCreditsInput,
  type PlatformGrantCreditsResponse,
  type PlatformJobCancelResponse,
  type PlatformJobStatusResponse,
  type PlatformOrganizationDetailResponse,
  type PlatformOrganizationsResponse,
  type PlatformProvisionServerInput,
  type PlatformProvisionServerResponse,
  type PlatformUsage,
} from "@otto/feature-platform"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function platformBootstrapQueryOptions() {
  return queryOptions({
    queryFn: async (): Promise<PlatformBootstrap> => {
      const response = await apiClient.api.platform.bootstrap.$get()
      return fetchApiResponse(response, (data) => platformBootstrapSchema.parse(data))
    },
    queryKey: ["platform-bootstrap"],
    staleTime: 60_000,
  })
}

export function platformOrganizationsQueryOptions() {
  return queryOptions({
    queryFn: async (): Promise<PlatformOrganizationsResponse> => {
      const response = await apiClient.api.platform.organizations.$get()
      return fetchApiResponse(response, (data) =>
        platformOrganizationsResponseSchema.parse(data),
      )
    },
    queryKey: ["platform-organizations"],
    staleTime: 30_000,
  })
}

export async function createPlatformOrganization(
  payload: PlatformCreateOrganizationInput,
): Promise<PlatformCreateOrganizationResponse> {
  const response = await apiClient.api.platform.organizations.$post({
    json: platformCreateOrganizationSchema.parse(payload),
  })

  return fetchApiResponse(response, (data) =>
    platformCreateOrganizationResponseSchema.parse(data),
  )
}

export async function addCurrentUserAsPlatformOrganizationAdmin(
  orgSlug: string,
): Promise<PlatformAddCurrentUserAdminResponse> {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"][
      "admin-membership"
    ].$post({
      param: {
        orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformAddCurrentUserAdminResponseSchema.parse(data),
  )
}

export function platformOrganizationDetailQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async (): Promise<PlatformOrganizationDetailResponse> => {
      const response =
        await apiClient.api.platform.organizations[":orgSlug"].$get({
          param: {
            orgSlug,
          },
        })

      return fetchApiResponse(response, (data) =>
        platformOrganizationDetailResponseSchema.parse(data),
      )
    },
    queryKey: ["platform-organization-detail", orgSlug],
    staleTime: 15_000,
  })
}

export function platformUsageQueryOptions(input: {
  from: string
  orgSlug: string
  to: string
}) {
  return queryOptions({
    queryFn: async (): Promise<PlatformUsage> => {
      const response =
        await apiClient.api.platform.organizations[":orgSlug"].usage.$get({
          param: {
            orgSlug: input.orgSlug,
          },
          query: {
            from: input.from,
            to: input.to,
          },
        })

      return fetchApiResponse(response, (data) => platformUsageSchema.parse(data))
    },
    queryKey: ["platform-usage", input.orgSlug, input.from, input.to],
    staleTime: 30_000,
  })
}

export async function applyPlatformOrganization(orgSlug: string) {
  const response = await apiClient.api.platform.organizations[":orgSlug"].apply.$post({
    param: {
      orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    platformActionResponseSchema.parse(data),
  )
}

export async function syncPlatformOrganizationSkills(orgSlug: string) {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"]["sync-skills"].$post({
      param: {
        orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformActionResponseSchema.parse(data),
  )
}

export async function deployPlatformRuntime(orgSlug: string) {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"]["deploy-runtime"].$post({
      param: {
        orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformActionResponseSchema.parse(data),
  )
}

export async function provisionPlatformServer(input: {
  orgSlug: string
  payload: PlatformProvisionServerInput
}): Promise<PlatformProvisionServerResponse> {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"]["provision-server"].$post({
      json: platformProvisionServerSchema.parse(input.payload),
      param: {
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformProvisionServerResponseSchema.parse(data),
  )
}

export async function provisionPlatformOpenAiKey(orgSlug: string) {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"]["provision-openai-key"].$post({
      param: {
        orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformProvisionOpenAiKeyResponseSchema.parse(data),
  )
}

export async function refreshPlatformRuntimeImage(orgSlug: string) {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"]["refresh-image"].$post({
      param: {
        orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformActionResponseSchema.parse(data),
  )
}

export async function grantPlatformCredits(input: {
  orgSlug: string
  payload: PlatformGrantCreditsInput
}): Promise<PlatformGrantCreditsResponse> {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"]["grant-credits"].$post({
      json: platformGrantCreditsSchema.parse(input.payload),
      param: {
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformGrantCreditsResponseSchema.parse(data),
  )
}

export async function deletePlatformWorkspace(
  orgSlug: string,
): Promise<PlatformDeleteWorkspaceResponse> {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"]["delete-workspace"].$post(
      {
        param: {
          orgSlug,
        },
      },
    )

  return fetchApiResponse(response, (data) =>
    platformDeleteWorkspaceResponseSchema.parse(data),
  )
}

export async function deletePlatformTenantServer(
  orgSlug: string,
): Promise<PlatformDeleteTenantServerResponse> {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"][
      "delete-tenant-server"
    ].$post({
      param: {
        orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformDeleteTenantServerResponseSchema.parse(data),
  )
}

export async function fetchPlatformJobStatus(input: {
  jobId: string
  orgSlug: string
}): Promise<PlatformJobStatusResponse> {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"].jobs[":jobId"].status.$get({
      param: {
        jobId: input.jobId,
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformJobStatusResponseSchema.parse(data),
  )
}

export async function cancelPlatformJob(input: {
  jobId: string
  orgSlug: string
}): Promise<PlatformJobCancelResponse> {
  const response =
    await apiClient.api.platform.organizations[":orgSlug"].jobs[":jobId"].cancel.$post({
      param: {
        jobId: input.jobId,
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    platformJobCancelResponseSchema.parse(data),
  )
}
