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
    enableWorkspaceIntegration: async () => ({
      applyQueued: false,
      status: "connected",
    }),
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
      setup: null,
      setupState: null,
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
    connectWorkspaceApiKeyIntegration: async () => ({
      applyQueued: false,
      status: "connected",
    }),
    applyWorkspaceIntegrationSetup: async () => ({
      applyQueued: false,
      status: "connected",
    }),
    discoverWorkspaceIntegrationSetup: async () => ({
      account: null,
      capabilityRecommendations: [],
      credential: {
        detectedScopes: [],
        warnings: [],
      },
      ok: true,
      resources: [],
      statePreview: {},
      warnings: [],
    }),
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
  it("accepts gandi as a workspace-managed integration in the route payloads", async () => {
    const app = createIntegrationsTestApp({
      ...createDependencies(),
      getWorkspaceIntegrationDetail: async ({ integrationKey, orgSlug }) => ({
        availableSections: ["status", "capabilities"],
        capabilities: [],
        connection: {
          availableActions: ["enable"],
          connectUrl: null,
          integrationKey: "gandi",
          label: "Gandi",
          message:
            "Enable Gandi so Otto can help founders evaluate company names and domain options in this workspace.",
          recommendedAction: "enable",
          requiresUserAction: false,
          selectedAction: "enable",
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
          categoryLabel: "Domains",
          description: "Founder naming, domain checks, and registration research.",
          iconSrc: "/integrations/gandi.svg",
          key: "gandi",
          label: "Gandi",
          managementMode: "workspace_managed",
          pageDescription:
            "Enable Gandi so Otto can help with company naming, domain checks, and registration research.",
        },
        settings: null,
        setup: null,
        setupState: null,
        summary: null,
      }),
      listWorkspaceIntegrations: async ({ orgSlug }) => [
        {
          categoryLabel: "Domains",
          connected: false,
          description:
            "Help founders evaluate company names, domain options, and registration constraints.",
          iconSrc: "/integrations/gandi.svg",
          key: "gandi",
          label: "Gandi",
          managementMode: "workspace_managed",
          needsAttention: false,
          settingsPath: `/${orgSlug}/settings/agent/integrations/gandi/status`,
        },
      ],
    })

    const listResponse = await app.request(
      "http://api.local/api/workspace/otto/integrations",
    )
    const detailResponse = await app.request(
      "http://api.local/api/workspace/otto/integrations/gandi",
    )

    assert.equal(listResponse.status, 200)
    assert.equal(detailResponse.status, 200)
    assert.deepEqual(await listResponse.json(), {
      integrations: [
        {
          categoryLabel: "Domains",
          connected: false,
          description:
            "Help founders evaluate company names, domain options, and registration constraints.",
          iconSrc: "/integrations/gandi.svg",
          key: "gandi",
          label: "Gandi",
          managementMode: "workspace_managed",
          needsAttention: false,
          settingsPath: "/otto/settings/agent/integrations/gandi/status",
        },
      ],
    })
  })

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

  it("enables a workspace-managed integration", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations/gandi/enable",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: false,
      status: "connected",
    })
  })

  it("connects a workspace API-key integration", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations/posthog/api-key",
      {
        body: JSON.stringify({
          apiKey: "phx_secret",
          declaredScopes: ["project:read"],
          defaultTargetKey: "production",
          host: "https://us.posthog.com",
          targets: [
            {
              environmentId: "env-1",
              key: "production",
              label: "Production",
              organizationId: "org-1",
              projectId: "project-1",
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: false,
      status: "connected",
    })
  })

  it("discovers workspace integration setup", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations/posthog/setup/discover",
      {
        body: JSON.stringify({
          apiKey: "phx_secret",
          host: "https://us.posthog.com",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      account: null,
      capabilityRecommendations: [],
      credential: {
        detectedScopes: [],
        warnings: [],
      },
      ok: true,
      resources: [],
      statePreview: {},
      warnings: [],
    })
  })

  it("applies workspace integration setup", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations/posthog/setup/apply",
      {
        body: JSON.stringify({
          apiKey: "phx_secret",
          defaultResourceKey: "product",
          enabledCapabilityKeys: ["feature_flag.list"],
          host: "https://us.posthog.com",
          selectedResourceKeys: ["product"],
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: false,
      status: "connected",
    })
  })

  it("disconnects gandi as a workspace-managed integration", async () => {
    const app = createIntegrationsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/integrations/gandi/disconnect",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: true,
      status: "disconnected",
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
