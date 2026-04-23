import assert from "node:assert/strict"
import { describe, it } from "vitest"

import type { WorkspaceIntegrationDetail } from "../types"
import {
  buildInitialApiKeySetupState,
  buildNextApiKeySetupStateFromDiscovery,
  extractClickableUrls,
} from "./IntegrationApiKeySetupFlow"

describe("IntegrationApiKeySetupFlow helpers", () => {
  it("prefills host, resources, default resource, and enabled capabilities from existing setup state", () => {
    const initial = buildInitialApiKeySetupState({
      detail: buildDetail({
        setupState: {
          host: "https://eu.posthog.com",
          setup: {
            defaultResourceKey: "product_app_production_env_1",
            resources: [
              {
                id: "env-1",
                key: "product_app_production_env_1",
                label: "Product App / Production",
                metadata: {
                  environmentId: "env-1",
                  projectId: "project-1",
                },
                type: "environment",
              },
            ],
            selectedResourceKeys: ["product_app_production_env_1"],
          },
        },
      }),
      setupDefaultHost: "https://us.posthog.com",
    })

    assert.equal(initial.host, "https://eu.posthog.com")
    assert.equal(initial.discovery?.resources.length, 1)
    assert.equal(initial.defaultResourceKey, "product_app_production_env_1")
    assert.deepEqual(initial.selectedResourceKeys, [
      "product_app_production_env_1",
    ])
    assert.deepEqual(initial.enabledCapabilityKeys, [
      "query.hogql",
      "workspace.list_projects",
    ])
  })

  it("extracts clickable URLs while preserving description text", () => {
    assert.deepEqual(
      extractClickableUrls(
        "Use https://us.posthog.com for US Cloud, https://eu.posthog.com for EU Cloud, or your self-hosted PostHog origin.",
      ),
      [
        { text: "Use ", type: "text" },
        { text: "https://us.posthog.com", type: "url" },
        { text: " for US Cloud, ", type: "text" },
        { text: "https://eu.posthog.com", type: "url" },
        {
          text: " for EU Cloud, or your self-hosted PostHog origin.",
          type: "text",
        },
      ],
    )
  })

  it("keeps previously enabled capabilities when rediscovery returns defaults", () => {
    const next = buildNextApiKeySetupStateFromDiscovery({
      currentDefaultResourceKey: "product_app_production_env_1",
      currentEnabledCapabilityKeys: ["query.hogql"],
      currentSelectedResourceKeys: ["product_app_production_env_1"],
      defaultResourceSelectionMode: "first",
      discovery: {
        account: null,
        capabilityRecommendations: [
          {
            capabilityKey: "query.hogql",
            defaultEnabled: false,
            label: "Run HogQL",
            reason: null,
            requiredScopes: [],
            status: "available",
          },
          {
            capabilityKey: "feature_flag.create",
            defaultEnabled: true,
            label: "Create feature flag",
            reason: null,
            requiredScopes: [],
            status: "available",
          },
        ],
        credential: {
          detectedScopes: [],
          warnings: [],
        },
        ok: true,
        resources: [
          {
            id: "env-1",
            key: "product_app_production_env_1",
            label: "Product App / Production",
            type: "environment",
          },
        ],
        statePreview: {},
        warnings: [],
      },
    })

    assert.deepEqual(next.enabledCapabilityKeys, ["query.hogql"])
  })
})

function buildDetail(input: {
  setupState: WorkspaceIntegrationDetail["setupState"]
}): WorkspaceIntegrationDetail {
  return {
    availableSections: ["status", "capabilities"],
    capabilities: [
      {
        capabilityKey: "query.hogql",
        capabilityType: "command",
        commandGroup: "query",
        description: "Run HogQL",
        effect: "read",
        label: "Run HogQL",
        policy: null,
        reason: null,
        sourceIcon: null,
        sourceLabel: "PostHog",
        sourceType: "integration",
        status: "enabled",
        userControllable: true,
      },
      {
        capabilityKey: "workspace.list_projects",
        capabilityType: "command",
        commandGroup: "workspace",
        description: "List projects",
        effect: "read",
        label: "List projects",
        policy: null,
        reason: null,
        sourceIcon: null,
        sourceLabel: "PostHog",
        sourceType: "integration",
        status: "enabled",
        userControllable: true,
      },
      {
        capabilityKey: "feature_flag.create",
        capabilityType: "command",
        commandGroup: "feature_flag",
        description: "Create feature flag",
        effect: "write",
        label: "Create feature flag",
        policy: null,
        reason: null,
        sourceIcon: null,
        sourceLabel: "PostHog",
        sourceType: "integration",
        status: "disabled",
        userControllable: true,
      },
    ],
    connection: {
      availableActions: [],
      connectUrl: null,
      integrationKey: "posthog",
      label: "PostHog",
      message: "Connected",
      recommendedAction: "none",
      requiresUserAction: false,
      selectedAction: "none",
      status: {
        connected: true,
        connectionStatus: null,
        enabled: true,
        integrationStatus: "connected",
        needsAttention: false,
      },
      workspaceUrl: null,
    },
    integration: {
      categoryLabel: "Product Analytics",
      description: "PostHog",
      iconSrc: null,
      key: "posthog",
      label: "PostHog",
      managementMode: "workspace_managed",
      pageDescription: "PostHog",
    },
    settings: null,
    setup: {
      credential: {
        label: "Personal API key",
      },
      discovery: {
        actionLabel: "Test and discover workspace",
        defaultResourceSelectionMode: "first",
        resourceSelectionLabel: "PostHog environments",
        supportsMultipleResources: true,
      },
      host: {
        defaultValue: "https://us.posthog.com",
        helpText: "Use https://us.posthog.com for US Cloud",
        label: "PostHog host",
        placeholder: "https://us.posthog.com",
      },
      mode: "api_key",
    },
    setupState: input.setupState,
    summary: null,
  }
}
