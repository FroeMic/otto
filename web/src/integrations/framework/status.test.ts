import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPlatformManagedIntegration,
  resolvePlatformManagedIntegrationStatus,
  resolveRuntimeIntegrationStatus,
} from "./status";
import type { IntegrationDefinition } from "./types";

const baseDefinition: IntegrationDefinition = {
  agentCapabilities: [],
  categoryLabel: "Search",
  catalogDescription: "Test",
  description: "Test integration.",
  iconSrc: null,
  key: "test",
  label: "Test",
  pageDescription: "Test integration.",
  runtimeSurface: {
    commandGroups: [],
    rootCommands: [],
    toolDescription: "Test tool.",
    toolName: "test",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/integrations2/test/status`,
  showInWorkspaceCatalog: true,
};

describe("integration status resolution", () => {
  it("treats platform-managed integrations as installed without tenant rows", () => {
    const resolved = resolveRuntimeIntegrationStatus({
      definition: {
        ...baseDefinition,
        managementMode: "platform_managed",
      },
      row: null,
    });

    assert.equal(resolved.installed, true);
    assert.equal(resolved.status.connected, true);
    assert.equal(resolved.status.enabled, true);
    assert.equal(resolved.status.connectionStatus, "managed");
    assert.equal(resolved.tenantIntegrationId, null);
  });

  it("uses the provider-owned platform status when supplied", () => {
    const status = resolvePlatformManagedIntegrationStatus({
      ...baseDefinition,
      managementMode: "platform_managed",
      resolveStatus: () => ({
        connected: false,
        connectionStatus: "managed",
        enabled: true,
        integrationStatus: "needs_attention",
        needsAttention: true,
      }),
    });

    assert.deepEqual(status, {
      connected: false,
      connectionStatus: "managed",
      enabled: true,
      integrationStatus: "needs_attention",
      needsAttention: true,
    });
  });

  it("keeps workspace-managed integrations uninstalled without tenant rows", () => {
    const resolved = resolveRuntimeIntegrationStatus({
      definition: baseDefinition,
      row: null,
    });

    assert.equal(resolved.installed, false);
    assert.equal(resolved.status.connected, false);
    assert.equal(resolved.status.enabled, false);
    assert.equal(isPlatformManagedIntegration(baseDefinition), false);
  });

  it("marks failed workspace-managed integrations as needing attention", () => {
    const resolved = resolveRuntimeIntegrationStatus({
      definition: baseDefinition,
      row: {
        connectedAt: null,
        connectionStatus: null,
        disconnectedAt: null,
        integrationStatus: "link_failed",
        tenantIntegrationId: "tenant-integration-1",
      },
    });

    assert.equal(resolved.installed, true);
    assert.equal(resolved.status.connected, false);
    assert.equal(resolved.status.enabled, false);
    assert.equal(resolved.status.needsAttention, true);
    assert.equal(resolved.status.integrationStatus, "link_failed");
  });
});
