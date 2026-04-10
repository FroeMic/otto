import {
  shellBootstrapSchema,
  type WorkspaceSettingsSuccess,
  workspaceSettingsSuccessSchema,
} from "@otto/feature-workspace-core"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"

import type { ConnectedAccount, UserProfile } from "../types"

export async function fetchApiResponse<T>(
  response: Response,
  parse: (input: unknown) => T,
): Promise<T> {
  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : "Request failed",
    )
  }

  return parse(data)
}

export function shellBootstrapQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.web.bootstrap[":orgSlug"].$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) => shellBootstrapSchema.parse(data))
    },
    queryKey: ["shell-bootstrap", orgSlug],
    staleTime: 60_000,
  })
}

export async function updateWorkspaceSettings(
  orgSlug: string,
  body:
    | { action: "update-name"; name: string }
    | { action: "update-slug"; slug: string }
    | { action: "update-locale"; locale: string }
    | { action: "update-time-format"; timeFormatPreference: string }
    | { action: "update-timezone"; timezone: string },
): Promise<WorkspaceSettingsSuccess> {
  const response = await apiClient.api.workspace[":orgSlug"].settings.$post({
    json: body,
    param: {
      orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceSettingsSuccessSchema.parse(data),
  )
}

export function userProfileQueryOptions() {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.user.profile.$get()

      return fetchApiResponse(response, (data) => data as UserProfile)
    },
    queryKey: ["user-profile"],
    staleTime: 60_000,
  })
}

export async function updateUserProfile(body: {
  firstName: string
  lastName: string
}): Promise<UserProfile> {
  const response = await apiClient.api.user.profile.$post({
    json: body,
  })

  return fetchApiResponse(response, (data) => data as UserProfile)
}

export function connectedAccountsQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"]["connected-accounts"].$get({
          param: {
            orgSlug,
          },
        })

      return fetchApiResponse(
        response,
        (data) => (data as { connectedAccounts: ConnectedAccount[] }).connectedAccounts,
      )
    },
    queryKey: ["connected-accounts", orgSlug],
    staleTime: 60_000,
  })
}
