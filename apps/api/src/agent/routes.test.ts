import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import type {
  WorkspaceChatConversationSummary,
  WorkspaceChatMessageCreateResponse,
  WorkspaceChatMessagePart,
} from "@otto/feature-workspace-chat"
import { Hono } from "hono"
import { describe, it } from "vitest"

import { type AgentRouteDependencies, createAgentRouter } from "./routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): AgentRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    getAgentPersonalizationDetail: async ({ instructionTab }) => ({
      defaultInstructionTab: "Agent.md",
      instruction: {
        description:
          "The main workspace playbook. It tells Otto how to start each session and how to work safely here.",
        filePath: "AGENTS.md",
        label: "Agent.md",
        sharedContent: "Use this section for workspace-specific rules.",
        slug: "Agent.md",
        systemContent: "AGENTS.md system content",
        version: 3,
      },
      selectedTab: {
        filePath: "AGENTS.md",
        label: "Agent.md",
        slug: instructionTab,
      },
      state: "ready",
      tabs: [
        {
          filePath: "AGENTS.md",
          label: "Agent.md",
          slug: "Agent.md",
        },
        {
          filePath: "IDENTITY.md",
          label: "Identity.md",
          slug: "Identity.md",
        },
      ],
    }),
    getAgentPersonalizationOverview: async () => ({
      defaultInstructionTab: "Agent.md",
      state: "ready",
      tabs: [
        {
          filePath: "AGENTS.md",
          label: "Agent.md",
          slug: "Agent.md",
        },
        {
          filePath: "IDENTITY.md",
          label: "Identity.md",
          slug: "Identity.md",
        },
      ],
    }),
    updateAgentPersonalizationInstruction: async ({ instructionTab }) => ({
      applyQueued: true,
      changed: true,
      currentVersion: 4,
      instruction: {
        description:
          "The main workspace playbook. It tells Otto how to start each session and how to work safely here.",
        filePath: "AGENTS.md",
        label: "Agent.md",
        sharedContent: "Updated content",
        slug: instructionTab,
        systemContent: "AGENTS.md system content",
        version: 4,
      },
    }),
    createPersonalizationOnboardingConversation: async () => ({
      id: "conv_personalize",
      kind: "ad_hoc",
      lastActivityAt: "2026-04-10T09:30:00.000Z",
      latestMessagePreview: null,
      originKind: "manual",
      title: "Personalize Otto",
      visibility: "personal",
    }),
    markWorkspaceAgentPersonalized: async () => undefined,
    sendPersonalizationOnboardingMessage: async ({
      conversationId,
      parts,
    }) => ({
      conversationId,
      dispatch: {
        status: "queued",
      },
      message: {
        author: {
          kind: "user",
          name: "Test User",
          userId: "user_123",
        },
        createdAt: "2026-04-10T09:32:00.000Z",
        id: "msg_1",
        parts,
        status: "completed",
      },
    }),
  }
}

function createAgentTestApp(
  dependencies: AgentRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createAgentRouter(dependencies))

  return app
}

describe("agent routes", () => {
  it("returns the personalization overview payload", async () => {
    const app = createAgentTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/agent/personalization",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      defaultInstructionTab: "Agent.md",
      state: "ready",
      tabs: [
        {
          filePath: "AGENTS.md",
          label: "Agent.md",
          slug: "Agent.md",
        },
        {
          filePath: "IDENTITY.md",
          label: "Identity.md",
          slug: "Identity.md",
        },
      ],
    })
  })

  it("returns the selected personalization tab payload", async () => {
    const app = createAgentTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/agent/personalization/Agent.md",
    )
    const data = (await response.json()) as {
      instruction: { filePath: string }
      selectedTab: { slug: string }
      state: string
    }

    assert.equal(response.status, 200)
    assert.equal(data.state, "ready")
    assert.equal(data.selectedTab.slug, "Agent.md")
    assert.equal(data.instruction.filePath, "AGENTS.md")
  })

  it("updates the selected personalization tab", async () => {
    const app = createAgentTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/agent/personalization/Agent.md",
      {
        body: JSON.stringify({
          expectedVersion: 3,
          sharedContent: "Updated content",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: true,
      changed: true,
      currentVersion: 4,
      instruction: {
        description:
          "The main workspace playbook. It tells Otto how to start each session and how to work safely here.",
        filePath: "AGENTS.md",
        label: "Agent.md",
        sharedContent: "Updated content",
        slug: "Agent.md",
        systemContent: "AGENTS.md system content",
        version: 4,
      },
    })
  })

  it("starts a guided personalization onboarding conversation", async () => {
    const createdConversations: Array<{
      orgSlug: string
      title: string
      userExternalId: string
      visibility: WorkspaceChatConversationSummary["visibility"]
    }> = []
    const sentMessages: Array<{
      conversationId: string
      orgSlug: string
      parts: WorkspaceChatMessagePart[]
      userExternalId: string
    }> = []
    const markedWorkspaces: Array<{
      orgSlug: string
      userExternalId: string
    }> = []
    const app = createAgentTestApp({
      ...createDependencies(),
      createPersonalizationOnboardingConversation: async (input) => {
        createdConversations.push(input)

        return {
          id: "conv_personalize",
          kind: "ad_hoc",
          lastActivityAt: "2026-04-10T09:30:00.000Z",
          latestMessagePreview: null,
          originKind: "manual",
          title: input.title,
          visibility: input.visibility,
        }
      },
      markWorkspaceAgentPersonalized: async (input) => {
        markedWorkspaces.push(input)
      },
      sendPersonalizationOnboardingMessage: async (input) => {
        sentMessages.push(input)

        return {
          conversationId: input.conversationId,
          dispatch: {
            status: "queued",
          },
          message: {
            author: {
              kind: "user",
              name: "Test User",
              userId: "user_123",
            },
            createdAt: "2026-04-10T09:32:00.000Z",
            id: "msg_1",
            parts: input.parts,
            status: "completed",
          },
        } satisfies WorkspaceChatMessageCreateResponse
      },
    })

    const response = await app.request(
      "http://api.local/api/workspace/otto/agent/personalization/onboarding/start",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), {
      conversation: {
        id: "conv_personalize",
        kind: "ad_hoc",
        lastActivityAt: "2026-04-10T09:30:00.000Z",
        latestMessagePreview: null,
        originKind: "manual",
        title: "Personalize Otto",
        visibility: "personal",
      },
    })
    assert.deepEqual(createdConversations, [
      {
        orgSlug: "otto",
        title: "Personalize Otto",
        userExternalId: "user_123",
        visibility: "personal",
      },
    ])
    assert.equal(sentMessages.length, 1)
    assert.equal(sentMessages[0]?.conversationId, "conv_personalize")
    assert.equal(sentMessages[0]?.orgSlug, "otto")
    assert.equal(sentMessages[0]?.userExternalId, "user_123")
    assert.equal(sentMessages[0]?.parts[0]?.type, "hidden_text")
    assert.match(
      sentMessages[0]?.parts[0]?.text ?? "",
      /first personalization onboarding/i,
    )
    assert.match(
      sentMessages[0]?.parts[0]?.text ?? "",
      /introduce yourself briefly/i,
    )
    assert.match(
      sentMessages[0]?.parts[0]?.text ?? "",
      /better Otto knows and understands the user, the better Otto will work/i,
    )
    assert.match(
      sentMessages[0]?.parts[0]?.text ?? "",
      /not business idea onboarding/i,
    )
    assert.match(sentMessages[0]?.parts[0]?.text ?? "", /Understand the user/i)
    assert.match(
      sentMessages[0]?.parts[0]?.text ?? "",
      /read_managed_file and patch_managed_file/i,
    )
    assert.match(sentMessages[0]?.parts[0]?.text ?? "", /telegram-style/i)
    assert.deepEqual(sentMessages[0]?.parts[1], {
      text: "Hi, I'm Test. I'd love to get to know you and personalize my experience.",
      type: "text",
    })
    assert.deepEqual(markedWorkspaces, [
      {
        orgSlug: "otto",
        userExternalId: "user_123",
      },
    ])
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createAgentTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/agent/personalization",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })
})
