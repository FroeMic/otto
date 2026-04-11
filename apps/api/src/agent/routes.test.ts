import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import {
  createAgentRouter,
  type AgentRouteDependencies,
} from "./routes"

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
