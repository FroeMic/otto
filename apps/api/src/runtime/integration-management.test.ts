import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { manageRuntimeIntegrationConnection } from "./integration-management"

describe("runtime integration management", () => {
  it("enables gandi directly when the runtime requests enable", async () => {
    let enabled = false

    const result = await manageRuntimeIntegrationConnection({
      action: "enable",
      enableRuntimeIntegrationForTenant: async ({ integrationKey, tenantId }) => {
        enabled = true
        assert.equal(integrationKey, "gandi")
        assert.equal(tenantId, "tenant_123")
      },
      getRuntimeIntegrationConnectionActionForTenant: async ({ integrationKey }) => {
        if (!enabled) {
          return {
            availableActions: ["open_workspace", "enable"],
            connectUrl: null,
            integrationKey,
            label: "Gandi",
            message: "Gandi is not enabled yet.",
            recommendedAction: "enable",
            requiresUserAction: true,
            selectedAction: "enable",
            status: {
              connected: false,
              connectionStatus: null,
              enabled: false,
              integrationStatus: null,
              needsAttention: false,
            },
            workspaceUrl: "https://otto.test/acme/settings/agent/integrations/gandi/status",
          }
        }

        return {
          availableActions: ["open_workspace"],
          connectUrl: null,
          integrationKey,
          label: "Gandi",
          message: "Gandi is enabled.",
          recommendedAction: "open_workspace",
          requiresUserAction: false,
          selectedAction: "open_workspace",
          status: {
            connected: true,
            connectionStatus: null,
            enabled: true,
            integrationStatus: "connected",
            needsAttention: false,
          },
          workspaceUrl: "https://otto.test/acme/settings/agent/integrations/gandi/status",
        }
      },
      integrationKey: "gandi",
      tenantId: "tenant_123",
    })

    assert.equal(enabled, true)
    assert.equal(result?.status.connected, true)
    assert.equal(result?.requiresUserAction, false)
    assert.equal(result?.selectedAction, "open_workspace")
  })

  it("does not auto-enable oauth-style integrations", async () => {
    let enabled = false

    const result = await manageRuntimeIntegrationConnection({
      action: "connect",
      enableRuntimeIntegrationForTenant: async () => {
        enabled = true
      },
      getRuntimeIntegrationConnectionActionForTenant: async ({ integrationKey }) => ({
        availableActions: ["open_workspace", "connect"],
        connectUrl: "https://otto.test/oauth/start/integration/slack",
        integrationKey,
        label: "Slack",
        message: "Slack is not connected yet.",
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
        workspaceUrl: "https://otto.test/acme/settings/agent/integrations/slack/status",
      }),
      integrationKey: "slack",
      tenantId: "tenant_123",
    })

    assert.equal(enabled, false)
    assert.equal(result?.selectedAction, "connect")
    assert.equal(result?.requiresUserAction, true)
  })
})
