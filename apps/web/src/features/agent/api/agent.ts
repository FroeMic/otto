import {
  agentInstructionUpdateRequestSchema,
  agentInstructionUpdateResponseSchema,
  agentPersonalizationDetailResponseSchema,
  agentPersonalizationOverviewResponseSchema,
} from "../../../../../api/src/agent/contracts"
import { queryOptions } from "@tanstack/react-query"

import { apiClient } from "@/client/app/rpc"
import { fetchApiResponse } from "@/features/workspace/api/workspace"

export function agentPersonalizationOverviewQueryOptions(orgSlug: string) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"].agent.personalization.$get({
          param: {
            orgSlug,
          },
        })

      return fetchApiResponse(response, (data) =>
        agentPersonalizationOverviewResponseSchema.parse(data),
      )
    },
    queryKey: ["agent-personalization-overview", orgSlug],
    staleTime: 30_000,
  })
}

export function agentPersonalizationDetailQueryOptions(input: {
  instructionTab: string
  orgSlug: string
}) {
  return queryOptions({
    queryFn: async () => {
      const response =
        await apiClient.api.workspace[":orgSlug"].agent.personalization[
          ":instructionTab"
        ].$get({
          param: {
            instructionTab: input.instructionTab,
            orgSlug: input.orgSlug,
          },
        })

      return fetchApiResponse(response, (data) =>
        agentPersonalizationDetailResponseSchema.parse(data),
      )
    },
    queryKey: ["agent-personalization-detail", input.orgSlug, input.instructionTab],
    staleTime: 30_000,
  })
}

export async function updateAgentPersonalizationInstruction(input: {
  expectedVersion?: number
  instructionTab: string
  orgSlug: string
  sharedContent: string
}) {
  const response =
    await apiClient.api.workspace[":orgSlug"].agent.personalization[
      ":instructionTab"
    ].$patch({
      json: agentInstructionUpdateRequestSchema.parse({
        expectedVersion: input.expectedVersion,
        sharedContent: input.sharedContent,
      }),
      param: {
        instructionTab: input.instructionTab,
        orgSlug: input.orgSlug,
      },
    })

  return fetchApiResponse(response, (data) =>
    agentInstructionUpdateResponseSchema.parse(data),
  )
}
