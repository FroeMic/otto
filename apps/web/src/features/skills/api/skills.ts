import {
  workspaceSkillCreateRequestSchema,
  workspaceSkillDeleteRequestSchema,
  workspaceSkillDeleteResponseSchema,
  workspaceSkillDetailResponseSchema,
  workspaceSkillMutationResponseSchema,
  workspaceSkillResetRequestSchema,
  workspaceSkillResetResponseSchema,
  workspaceSkillsListResponseSchema,
  workspaceSkillUpdateRequestSchema,
} from "@otto/feature-runtime-core"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function workspaceSkillsQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response = await apiClient.api.workspace[":orgSlug"].skills.$get({
        param: {
          orgSlug,
        },
      })

      return fetchApiResponse(response, (data) =>
        workspaceSkillsListResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-skills", orgSlug],
    staleTime: 30_000,
  })
}

export function workspaceSkillDetailQueryOptions(input: {
  orgSlug: string
  skillKey: string
}) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"].skills[":skillKey"].$get({
          param: {
            orgSlug: input.orgSlug,
            skillKey: input.skillKey,
          },
        })

      return fetchApiResponse(response, (data) =>
        workspaceSkillDetailResponseSchema.parse(data),
      )
    },
    queryKey: ["workspace-skill-detail", input.orgSlug, input.skillKey],
    staleTime: 30_000,
  })
}

export async function createWorkspaceSkill(input: {
  description: string
  integrationKeys: string[]
  name: string
  orgSlug: string
  skillBody: string
  skillKey: string
  skillKeys: string[]
}) {
  const response = await apiClient.api.workspace[":orgSlug"].skills.$post({
    json: workspaceSkillCreateRequestSchema.parse({
      description: input.description,
      integrationKeys: input.integrationKeys,
      name: input.name,
      skillBody: input.skillBody,
      skillKey: input.skillKey,
      skillKeys: input.skillKeys,
    }),
    param: {
      orgSlug: input.orgSlug,
    },
  })

  return fetchApiResponse(response, (data) =>
    workspaceSkillMutationResponseSchema.parse(data),
  )
}

export async function updateWorkspaceSkill(input: {
  description: string
  expectedVersion?: number
  integrationKeys: string[]
  name: string
  orgSlug: string
  skillBody: string
  skillKey: string
  skillKeys: string[]
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].skills[":skillKey"].$patch({
      json: workspaceSkillUpdateRequestSchema.parse({
        description: input.description,
        expectedVersion: input.expectedVersion,
        integrationKeys: input.integrationKeys,
        name: input.name,
        skillBody: input.skillBody,
        skillKeys: input.skillKeys,
      }),
      param: {
        orgSlug: input.orgSlug,
        skillKey: input.skillKey,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceSkillMutationResponseSchema.parse(data),
  )
}

export async function installWorkspaceLibrarySkill(input: {
  orgSlug: string
  skillKey: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].skills.library[":skillKey"].install.$post(
      {
        param: {
          orgSlug: input.orgSlug,
          skillKey: input.skillKey,
        },
      },
    )

  return fetchApiResponse(response, (data) =>
    workspaceSkillMutationResponseSchema.parse(data),
  )
}

export async function resetWorkspaceSkillPackage(input: {
  expectedVersion?: number
  orgSlug: string
  scope?: "companion_files"
  skillKey: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].skills[":skillKey"].reset.$post({
      json: workspaceSkillResetRequestSchema.parse({
        expectedVersion: input.expectedVersion,
        scope: input.scope ?? "companion_files",
      }),
      param: {
        orgSlug: input.orgSlug,
        skillKey: input.skillKey,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceSkillResetResponseSchema.parse(data),
  )
}

export async function removeWorkspaceSkill(input: {
  expectedVersion: number
  orgSlug: string
  skillKey: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].skills[":skillKey"].$delete({
      json: workspaceSkillDeleteRequestSchema.parse({
        expectedVersion: input.expectedVersion,
      }),
      param: {
        orgSlug: input.orgSlug,
        skillKey: input.skillKey,
      },
    })

  return fetchApiResponse(response, (data) =>
    workspaceSkillDeleteResponseSchema.parse(data),
  )
}
