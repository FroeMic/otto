import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

import type { IntegrationDefinition } from "./types";

const getConnectedApiCredentialForTenantIntegration = vi.fn();
const getConnectedOauthAccessForTenantIntegration = vi.fn();
const getIntegrationDefinition = vi.fn();
const recordApiCredentialAttention = vi.fn();
const recordOauthConnectionAttention = vi.fn();

vi.mock("../../db/api-credentials", () => ({
  getConnectedApiCredentialForTenantIntegration,
  recordApiCredentialAttention,
}));

vi.mock("../../db/oauth", () => ({
  getConnectedOauthAccessForTenantIntegration,
  recordOauthConnectionAttention,
}));

vi.mock("./registry", () => ({
  getIntegrationDefinition,
}));

function buildApiKeyIntegrationDefinition(
  execute: NonNullable<
    IntegrationDefinition["runtimeSurface"]
  >["rootCommands"][number]["execute"],
): IntegrationDefinition {
  return {
    agentCapabilities: [],
    auth: {
      credentialType: "personal_api_key",
      kind: "api_key",
    },
    categoryLabel: "Analytics",
    catalogDescription: "PostHog test integration.",
    description: "PostHog test integration.",
    iconSrc: null,
    key: "posthog",
    label: "PostHog",
    pageDescription: "PostHog test integration.",
    runtimeSurface: {
      commandGroups: [],
      rootCommands: [
        {
          argumentsSchema: {
            additionalProperties: false,
            properties: {},
            type: "object",
          },
          commandKey: "query.hogql",
          commandPath: ["query", "hogql"],
          description: "Run a read-only HogQL query.",
          execute,
          inputMode: "json",
          label: "Run HogQL",
          requiredProviderScopes: ["query:read"],
          resultMode: "json",
        },
      ],
      toolDescription: "PostHog commands.",
      toolName: "posthog",
    },
    settingsPath: (orgSlug) =>
      `/${orgSlug}/settings/agent/integrations/posthog/status`,
    showInWorkspaceCatalog: true,
  };
}

describe("executeRegisteredIntegrationCommand", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("resolves API-key credentials and passes them to the command context", async () => {
    const execute = vi.fn(async ({ context }) => ({
      apiKey: context.auth?.kind === "api_key" ? context.auth.apiKey : null,
      host:
        context.auth?.kind === "api_key"
          ? context.auth.state.host
          : null,
    }));
    getIntegrationDefinition.mockReturnValue(
      buildApiKeyIntegrationDefinition(execute),
    );
    getConnectedApiCredentialForTenantIntegration.mockResolvedValue({
      apiKey: "phx_secret",
      credentialId: "credential-1",
      declaredScopes: ["query:read"],
      externalAccountLabel: "Product analytics",
      metadata: {},
      providerKey: "posthog",
      state: {
        host: "https://us.posthog.com",
      },
      stateVersion: 1,
      status: "connected",
      tenantIntegrationId: "tenant-integration-1",
    });

    const { executeRegisteredIntegrationCommand } = await import("./execute");

    const result = await executeRegisteredIntegrationCommand({
      arguments: {},
      commandKey: "query.hogql",
      integrationKey: "posthog",
      tenantIntegrationId: "tenant-integration-1",
    });

    assert.deepEqual(result, {
      apiKey: "phx_secret",
      host: "https://us.posthog.com",
    });
    assert.equal(execute.mock.calls.length, 1);
  });

  it("blocks API-key commands when declared scopes are missing", async () => {
    getIntegrationDefinition.mockReturnValue(
      buildApiKeyIntegrationDefinition(async () => ({})),
    );
    getConnectedApiCredentialForTenantIntegration.mockResolvedValue({
      apiKey: "phx_secret",
      credentialId: "credential-1",
      declaredScopes: ["project:read"],
      externalAccountLabel: "Product analytics",
      metadata: {},
      providerKey: "posthog",
      state: {},
      stateVersion: 1,
      status: "connected",
      tenantIntegrationId: "tenant-integration-1",
    });

    const { executeRegisteredIntegrationCommand } = await import("./execute");

    await assert.rejects(
      executeRegisteredIntegrationCommand({
        arguments: {},
        commandKey: "query.hogql",
        integrationKey: "posthog",
        tenantIntegrationId: "tenant-integration-1",
      }),
      /requires the query:read PostHog scope/,
    );
  });

  it("does not mark API-key credentials as needing attention for provider request errors", async () => {
    const providerError = Object.assign(new Error("HogQL query failed"), {
      status: 400,
    });
    getIntegrationDefinition.mockReturnValue(
      buildApiKeyIntegrationDefinition(async () => {
        throw providerError;
      }),
    );
    getConnectedApiCredentialForTenantIntegration.mockResolvedValue({
      apiKey: "phx_secret",
      credentialId: "credential-1",
      declaredScopes: ["query:read"],
      externalAccountLabel: "Product analytics",
      metadata: {},
      providerKey: "posthog",
      state: {},
      stateVersion: 1,
      status: "connected",
      tenantIntegrationId: "tenant-integration-1",
    });

    const { executeRegisteredIntegrationCommand } = await import("./execute");

    await assert.rejects(
      executeRegisteredIntegrationCommand({
        arguments: {},
        commandKey: "query.hogql",
        integrationKey: "posthog",
        tenantIntegrationId: "tenant-integration-1",
      }),
      /HogQL query failed/,
    );
    assert.equal(recordApiCredentialAttention.mock.calls.length, 0);
  });

  it("marks API-key credentials as needing attention for provider auth errors", async () => {
    const providerError = Object.assign(new Error("Invalid API key"), {
      status: 401,
    });
    getIntegrationDefinition.mockReturnValue(
      buildApiKeyIntegrationDefinition(async () => {
        throw providerError;
      }),
    );
    getConnectedApiCredentialForTenantIntegration.mockResolvedValue({
      apiKey: "phx_secret",
      credentialId: "credential-1",
      declaredScopes: ["query:read"],
      externalAccountLabel: "Product analytics",
      metadata: {},
      providerKey: "posthog",
      state: {},
      stateVersion: 1,
      status: "connected",
      tenantIntegrationId: "tenant-integration-1",
    });

    const { executeRegisteredIntegrationCommand } = await import("./execute");

    await assert.rejects(
      executeRegisteredIntegrationCommand({
        arguments: {},
        commandKey: "query.hogql",
        integrationKey: "posthog",
        tenantIntegrationId: "tenant-integration-1",
      }),
      /Reconnect PostHog/,
    );
    assert.equal(recordApiCredentialAttention.mock.calls.length, 1);
    assert.deepEqual(recordApiCredentialAttention.mock.calls[0]?.[0], {
      credentialId: "credential-1",
      errorMessage: "Invalid API key",
    });
  });
});
