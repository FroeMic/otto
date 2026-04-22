import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  type AgentInstructionUpdateResponse,
  type AgentPersonalizationDetailResponse,
  type AgentPersonalizationOverviewResponse,
  agentInstructionUpdateRequestSchema,
  agentInstructionUpdateResponseSchema,
  agentPersonalizationDetailResponseSchema,
  agentPersonalizationOverviewResponseSchema,
} from "@otto/feature-runtime-core"
import {
  type WorkspaceChatConversationSummary,
  type WorkspaceChatMessageCreateResponse,
  type WorkspaceChatMessagePart,
  workspaceChatConversationCreateResponseSchema,
} from "@otto/feature-workspace-chat"
import { Hono } from "hono"
import { z } from "zod"
import { createWorkspaceChatConversation } from "../workspace/chat-data"
import { createAndDispatchWorkspaceChatMessage } from "../workspace/chat-service"
import {
  getAgentPersonalizationDetail,
  getAgentPersonalizationOverview,
  markWorkspaceAgentPersonalized,
  updateAgentPersonalizationInstruction,
} from "./data"

const workspaceAgentParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceAgentInstructionParamsSchema = workspaceAgentParamsSchema.extend(
  {
    instructionTab: z.string().min(1),
  },
)

export interface AgentRouteUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export interface AgentRouteDependencies {
  authenticateWorkspaceUser: (request: Request) => Promise<AgentRouteUser>
  createPersonalizationOnboardingConversation: (input: {
    orgSlug: string
    title: string
    userExternalId: string
    visibility: WorkspaceChatConversationSummary["visibility"]
  }) => Promise<WorkspaceChatConversationSummary>
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
  markWorkspaceAgentPersonalized: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<void>
  sendPersonalizationOnboardingMessage: (input: {
    clientMessageId?: string
    conversationId: string
    orgSlug: string
    parts: WorkspaceChatMessagePart[]
    userDisplayName: string
    userExternalId: string
  }) => Promise<WorkspaceChatMessageCreateResponse>
}

function createDefaultAgentRouteDependencies(): AgentRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    createPersonalizationOnboardingConversation: async (input) => {
      const result = await createWorkspaceChatConversation({
        kind: "ad_hoc",
        orgSlug: input.orgSlug,
        title: input.title,
        userExternalId: input.userExternalId,
        visibility: input.visibility,
      })

      return result.createdConversation
    },
    getAgentPersonalizationDetail,
    getAgentPersonalizationOverview,
    markWorkspaceAgentPersonalized,
    sendPersonalizationOnboardingMessage: createAndDispatchWorkspaceChatMessage,
    updateAgentPersonalizationInstruction,
  }
}

function buildPersonalizationOnboardingVisiblePrompt(user: AgentRouteUser) {
  const name = user.firstName?.trim() || buildUserDisplayName(user)
  return `Hi, I'm ${name}. I'd love to get to know you and personalize my experience.`
}

function buildPersonalizationOnboardingHiddenPrompt(visiblePrompt: string) {
  return [
    "You are running Otto's first personalization onboarding for this workspace.",
    "",
    `The visible user message is: "${visiblePrompt}".`,
    "",
    "First visible assistant message:",
    "- Introduce yourself briefly as Otto.",
    "- Explain that the better Otto knows and understands the user, the better Otto will work for them.",
    "- Keep this introduction concise, then ask one focused question.",
    "",
    "This is personalization onboarding, not business idea onboarding.",
    "Do not use the business idea onboarding skill unless the user explicitly asks to work on a business idea.",
    "Do not start by asking what they are building.",
    "",
    "Goals:",
    "- Understand the user: who they are, their role, responsibilities, goals, taste, working style, communication preferences, recurring priorities, and what they want Otto to feel like.",
    "- Ask about Otto's personality and collaboration style: concise vs. expansive, proactive vs. wait-for-instructions, tone, preferred challenge level, and any hard boundaries.",
    "- Help the user understand that they can use the voice button for long messages.",
    "- Explain that they can ask Otto to change these settings any time, or review them in workspace settings under Agent > Personalization.",
    "- Introduce useful workspace features naturally when relevant: sessions history, files, skills, scheduled tasks, integrations, and workspace settings.",
    "- When the user gives clear preference or identity signal, update the managed personalization files with read_managed_file and patch_managed_file. Do not edit root files directly.",
    "- Keep managed-file updates short, durable, and telegram-style. Preserve non-template content and do not overwrite user-specific edits.",
    "",
    "Conversation style:",
    "- Start conversationally with one focused question about the user or preferred working style.",
    "- Do not ask a long questionnaire.",
    "- Prefer short turns, reflect what you learned, then update the managed personalization files when there is enough signal.",
  ].join("\n")
}

function buildUserDisplayName(user: AgentRouteUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
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

        return jsonNoStore(
          agentPersonalizationOverviewResponseSchema.parse(response),
        )
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

        return jsonNoStore(
          agentPersonalizationDetailResponseSchema.parse(response),
        )
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

        const response =
          await dependencies.updateAgentPersonalizationInstruction({
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
    .post(
      "/api/workspace/:orgSlug/agent/personalization/onboarding/start",
      zValidator("param", workspaceAgentParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const orgSlug = context.req.valid("param").orgSlug
        const visiblePrompt = buildPersonalizationOnboardingVisiblePrompt(
          authResult.user,
        )
        const conversation =
          await dependencies.createPersonalizationOnboardingConversation({
            orgSlug,
            title: "Personalize Otto",
            userExternalId: authResult.user.id,
            visibility: "open",
          })

        await dependencies.sendPersonalizationOnboardingMessage({
          clientMessageId: crypto.randomUUID(),
          conversationId: conversation.id,
          orgSlug,
          parts: [
            {
              text: buildPersonalizationOnboardingHiddenPrompt(visiblePrompt),
              type: "hidden_text",
            },
            {
              text: visiblePrompt,
              type: "text",
            },
          ],
          userDisplayName: buildUserDisplayName(authResult.user),
          userExternalId: authResult.user.id,
        })

        await dependencies.markWorkspaceAgentPersonalized({
          orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceChatConversationCreateResponseSchema.parse({
            conversation,
          }),
          201,
        )
      },
    )
}
