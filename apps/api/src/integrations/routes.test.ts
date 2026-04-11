import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import {
  createIntegrationsRouter,
  type IntegrationsRouteDependencies,
} from "./routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): IntegrationsRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    disconnectWorkspaceIntegration: async () => ({
      applyQueued: true,
      status: "disconnected",
    }),
    enqueueWorkspaceSlackDirectoryResync: async () => ({
      jobId: "job_sync_channels_1",
      ok: true,
    }),
    getWorkspaceJobStatus: async () => ({
      error: null,
      finishedAt: null,
      ok: false,
      status: "running",
    }),
    getWorkspaceIntegrationDetail: async ({ integrationKey, orgSlug }) => ({
      availableSections: [
        "status",
        "capabilities",
        "configuration",
        "people",
        "channels",
      ],
      capabilities: [
        {
          capabilityKey: "slack:tool:send",
          capabilityType: "command",
          commandGroup: "messaging",
          description: "Send Slack messages",
          effect: "write",
          label: "Send messages",
          policy: null,
          reason: null,
          sourceIcon: "/integrations/slack.svg",
          sourceLabel: "Slack",
          sourceType: "integration",
          status: "enabled",
          userControllable: false,
        },
      ],
      connection: {
        availableActions: ["connect"],
        connectUrl: `/oauth/start/integration/${integrationKey}?orgSlug=${orgSlug}`,
        integrationKey: "slack",
        label: "Slack",
        message: "Slack is available.",
        recommendedAction: "connect",
        requiresUserAction: true,
        selectedAction: "connect",
        status: {
          connected: false,
          connectionStatus: null,
          enabled: false,
          integrationStatus: null,
          needsAttention: false,
        },
        workspaceUrl: `/${orgSlug}/settings/agent/integrations/${integrationKey}/status`,
      },
      integration: {
        categoryLabel: "Messaging",
        description: "Slack integration detail.",
        iconSrc: "/integrations/slack.svg",
        key: "slack",
        label: "Slack",
        managementMode: "workspace_managed",
        pageDescription: "Manage Slack connection status.",
      },
      settings: null,
      summary: null,
    }),
    listWorkspaceIntegrations: async ({ orgSlug }) => [
      {
        categoryLabel: "Messaging",
        connected: false,
        description: "Choose who can use Otto in Slack and where Otto can reply.",
        iconSrc: "/integrations/slack.svg",
        key: "slack",
        label: "Slack",
        managementMode: "workspace_managed",
        needsAttention: false,
        settingsPath: `/${orgSlug}/settings/agent/integrations/slack/status`,
      },
    ],
    updateWorkspaceIntegrationCapabilityPolicy: async () => ({
      capabilityKey: "slack:tool:send",
      capabilityType: "command",
      commandGroup: "messaging",
      description: "Send Slack messages",
      effect: "write",
      label: "Send messages",
      policy: { policy: "allow" },
      reason: null,
      sourceIcon: "/integrations/slack.svg",
      sourceLabel: "Slack",
      sourceType: "integration",
      status: "enabled",
      userControllable: false,
    }),
    updateWorkspaceSlackChannelMembership: ((async () => ({
      applyQueued: false,
      surface: {
        availableChannels: [],
      },
    })) as unknown) as IntegrationsRouteDependencies["updateWorkspaceSlackChannelMembership"],
    updateWorkspaceSlackSettings: ((async () => ({
      surface: {},
      validation: {
        ok: true,
        warnings: [],
      },
    })) as unknown) as IntegrationsRouteDependencies["updateWorkspaceSlackSettings"],
  }
}

function createIntegrationsTestApp(
  dependencies: IntegrationsRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createIntegrationsRouter(dependencies))

  return app
}

describe("integrations routes", () => {
  it("returns the integrations catalog payload", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      integrations: [
        {
          categoryLabel: "Messaging",
          connected: false,
          description:
            "Choose who can use Otto in Slack and where Otto can reply.",
          iconSrc: "/integrations/slack.svg",
          key: "slack",
          label: "Slack",
          managementMode: "workspace_managed",
          needsAttention: false,
          settingsPath: "/otto/settings/agent/integrations/slack/status",
        },
      ],
    })
  })

  it("returns the integration detail payload", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations/slack",
    )
    const data = (await response.json()) as {
      availableSections: string[]
      integration: {
        key: string
      }
    }

    assert.equal(response.status, 200)
    assert.equal(data.integration.key, "slack")
    assert.equal(data.availableSections.includes("configuration"), true)
  })

  it("queues a slack directory resync job", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations/slack/resync-directory",
      {
        body: JSON.stringify({
          action: "channels",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      jobId: "job_sync_channels_1",
      ok: true,
    })
  })

  it("returns workspace job status", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/jobs/job_sync_channels_1/status",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      error: null,
      finishedAt: null,
      ok: false,
      status: "running",
    })
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createIntegrationsTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })
})
