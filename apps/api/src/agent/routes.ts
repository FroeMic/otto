import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import { Hono } from "hono"
import { z } from "zod"

import {
  agentInstructionUpdateRequestSchema,
  agentInstructionUpdateResponseSchema,
  agentPersonalizationDetailResponseSchema,
  agentPersonalizationOverviewResponseSchema,
  type AgentPersonalizationDetailResponse,
  type AgentPersonalizationOverviewResponse,
  type AgentInstructionUpdateResponse,
} from "./contracts"
import {
  getAgentPersonalizationDetail,
  getAgentPersonalizationOverview,
  updateAgentPersonalizationInstruction,
} from "./data"

const workspaceAgentParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceAgentInstructionParamsSchema = workspaceAgentParamsSchema.extend({
  instructionTab: z.string().min(1),
})

export interface AgentRouteUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export interface AgentRouteDependencies {
  authenticateWorkspaceUser: (request: Request) => Promise<AgentRouteUser>
  getAgentPersonalizationDetail: (input: {
    instructionTab: string
    orgSlug: string
    userExternalId: string
  }) => Promise<AgentPersonalizationDetailResponse | null>
  getAgentPersonalizationOverview: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<AgentPersonalizationOverviewResponse>
  updateAgentPersonalizationInstruction: (input: {
    expectedVersion?: number
    instructionTab: string
    orgSlug: string
    sharedContent: string
    userExternalId: string
  }) => Promise<AgentInstructionUpdateResponse | null>
}

function createDefaultAgentRouteDependencies(): AgentRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    getAgentPersonalizationDetail,
    getAgentPersonalizationOverview,
    updateAgentPersonalizationInstruction,
  }
}

export function createAgentRouter(
  dependencies: AgentRouteDependencies = createDefaultAgentRouteDependencies(),
) {
  const app = new Hono()

  async function authenticateUser(request: Request) {
    try {
      return {
        user: await dependencies.authenticateWorkspaceUser(request),
      } as const
    } catch (error) {
      if (isWorkspaceSessionAuthError(error)) {
        return {
          response: jsonNoStore(
            {
              code: error.code,
              message: error.message,
            },
            error.status,
          ),
        } as const
      }

      throw error
    }
  }

  return app
    .get(
      "/api/workspace/:orgSlug/agent/personalization",
      zValidator("param", workspaceAgentParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.getAgentPersonalizationOverview({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(agentPersonalizationOverviewResponseSchema.parse(response))
      },
    )
    .get(
      "/api/workspace/:orgSlug/agent/personalization/:instructionTab",
      zValidator("param", workspaceAgentInstructionParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.getAgentPersonalizationDetail({
          instructionTab: context.req.valid("param").instructionTab,
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "agent_instruction_not_found",
              message: "Agent personalization tab not found",
            },
            404,
          )
        }

        return jsonNoStore(agentPersonalizationDetailResponseSchema.parse(response))
      },
    )
    .patch(
      "/api/workspace/:orgSlug/agent/personalization/:instructionTab",
      zValidator("json", agentInstructionUpdateRequestSchema),
      zValidator("param", workspaceAgentInstructionParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.updateAgentPersonalizationInstruction({
          expectedVersion: context.req.valid("json").expectedVersion,
          instructionTab: context.req.valid("param").instructionTab,
          orgSlug: context.req.valid("param").orgSlug,
          sharedContent: context.req.valid("json").sharedContent,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "agent_instruction_not_found",
              message: "Agent personalization tab not found",
            },
            404,
          )
        }

        return jsonNoStore(agentInstructionUpdateResponseSchema.parse(response))
      },
    )
}
