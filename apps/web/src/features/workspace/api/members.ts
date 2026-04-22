import {
  type InviteWorkspaceMembersInput,
  inviteWorkspaceMembersResponseSchema,
  inviteWorkspaceMembersSchema,
  updateWorkspaceMemberRoleSchema,
  type WorkspaceMemberDirectoryEntry,
  workspaceMemberDirectorySchema,
  workspaceMemberEntryResponseSchema,
} from "@otto/feature-workspace-members"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"

import { fetchApiResponse } from "./workspace"

export function workspaceMembersQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"].members.$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceMemberDirectorySchema.parse(data),
      )
    },
    queryKey: ["workspace-members", orgSlug],
    staleTime: 30_000,
  })
}

export async function inviteWorkspaceMembers(input: {
  orgSlug: string
  payload: InviteWorkspaceMembersInput
}) {
  const response = await apiClient.api.workspace[
    ":orgSlug"
  ].members.invitations.$post({
    json: inviteWorkspaceMembersSchema.parse(input.payload),
    param: {
      orgSlug: input.orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    inviteWorkspaceMembersResponseSchema.parse(data),
  )
}

async function parseEntryResponse(response: Response) {
  const payload = await fetchApiResponse(response, (data) =>
    workspaceMemberEntryResponseSchema.parse(data),
  )

  return payload.entry
}

export async function updateWorkspaceMemberRole(input: {
  membershipId: string
  orgSlug: string
  roleSlug: string
}): Promise<WorkspaceMemberDirectoryEntry> {
  const response = await apiClient.api.workspace[":orgSlug"].members[
    ":membershipId"
  ].role.$post({
    json: updateWorkspaceMemberRoleSchema.parse({
      roleSlug: input.roleSlug,
    }),
    param: {
      membershipId: input.membershipId,
      orgSlug: input.orgSlug,
    },
  })

  return parseEntryResponse(response)
}

export async function suspendWorkspaceMember(input: {
  membershipId: string
  orgSlug: string
}): Promise<WorkspaceMemberDirectoryEntry> {
  const response = await apiClient.api.workspace[":orgSlug"].members[
    ":membershipId"
  ].suspend.$post({
    param: {
      membershipId: input.membershipId,
      orgSlug: input.orgSlug,
    },
  })

  return parseEntryResponse(response)
}

export async function reactivateWorkspaceMember(input: {
  membershipId: string
  orgSlug: string
}): Promise<WorkspaceMemberDirectoryEntry> {
  const response = await apiClient.api.workspace[":orgSlug"].members[
    ":membershipId"
  ].reactivate.$post({
    param: {
      membershipId: input.membershipId,
      orgSlug: input.orgSlug,
    },
  })

  return parseEntryResponse(response)
}

export async function resendWorkspaceInvitation(input: {
  invitationId: string
  orgSlug: string
}): Promise<WorkspaceMemberDirectoryEntry> {
  const response = await apiClient.api.workspace[
    ":orgSlug"
  ].members.invitations[":invitationId"].resend.$post({
    param: {
      invitationId: input.invitationId,
      orgSlug: input.orgSlug,
    },
  })

  return parseEntryResponse(response)
}

export async function revokeWorkspaceInvitation(input: {
  invitationId: string
  orgSlug: string
}): Promise<WorkspaceMemberDirectoryEntry> {
  const response = await apiClient.api.workspace[
    ":orgSlug"
  ].members.invitations[":invitationId"].revoke.$post({
    param: {
      invitationId: input.invitationId,
      orgSlug: input.orgSlug,
    },
  })

  return parseEntryResponse(response)
}
