import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

const getDb = vi.fn();

vi.mock("./client", () => ({
  getDb,
}));

describe("integration API credentials", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CONTROL_PLANE_ENCRYPTION_SECRET =
      "test-control-plane-encryption-secret";
    process.env.DATABASE_URL = "postgres://otto:otto@localhost:5432/otto";
  });

  it("normalizes declared scopes deterministically", async () => {
    const { normalizeApiCredentialScopes } = await import("./api-credentials");

    assert.deepEqual(
      normalizeApiCredentialScopes([
        " feature_flag:read ",
        "query:read",
        "feature_flag:read",
        "",
      ]),
      ["feature_flag:read", "query:read"],
    );
  });

  it("encrypts API key material when upserting a credential", async () => {
    const values: Record<string, unknown>[] = [];
    const insertBuilder = {
      values: vi.fn((nextValues: Record<string, unknown>) => {
        values.push(nextValues);
        return insertBuilder;
      }),
      onConflictDoUpdate: vi.fn(() => Promise.resolve()),
    };
    getDb.mockReturnValue({
      insert: vi.fn(() => insertBuilder),
    });

    const { upsertApiCredentialForTenantIntegration } = await import(
      "./api-credentials"
    );

    await upsertApiCredentialForTenantIntegration({
      apiKey: "phx_secret",
      credentialType: "personal_api_key",
      declaredScopes: ["query:read"],
      externalAccountLabel: "Product analytics",
      metadata: { host: "https://us.posthog.com" },
      providerKey: "posthog",
      tenantIntegrationId: "tenant-integration-1",
    });

    assert.equal(values.length, 1);
    assert.equal(values[0]?.providerKey, "posthog");
    assert.equal(values[0]?.declaredScopesCsv, "query:read");
    assert.notEqual(values[0]?.secretCiphertext, "phx_secret");
    assert.match(String(values[0]?.secretCiphertext), /^[^.]+\.[^.]+\.[^.]+$/);
  });

  it("decrypts a connected API credential with provider state", async () => {
    const { encryptControlPlaneSecret } = await import("../lib/crypto");
    const encrypted = encryptControlPlaneSecret("phx_secret");
    const selectBuilder = {
      from: vi.fn(() => selectBuilder),
      innerJoin: vi.fn(() => selectBuilder),
      limit: vi.fn(() =>
        Promise.resolve([
          {
            credentialId: "credential-1",
            declaredScopesCsv: "query:read,feature_flag:read",
            externalAccountLabel: "Product analytics",
            metadata: { validated: true },
            providerKey: "posthog",
            secretCiphertext: encrypted,
            stateJson: {
              defaultTargetKey: "production",
              host: "https://us.posthog.com",
            },
            stateVersion: 2,
            status: "connected",
            tenantIntegrationId: "tenant-integration-1",
          },
        ]),
      ),
      where: vi.fn(() => selectBuilder),
    };
    getDb.mockReturnValue({
      select: vi.fn(() => selectBuilder),
    });

    const { getConnectedApiCredentialForTenantIntegration } = await import(
      "./api-credentials"
    );

    const credential = await getConnectedApiCredentialForTenantIntegration({
      providerKey: "posthog",
      tenantIntegrationId: "tenant-integration-1",
    });

    assert.deepEqual(credential, {
      apiKey: "phx_secret",
      credentialId: "credential-1",
      declaredScopes: ["feature_flag:read", "query:read"],
      externalAccountLabel: "Product analytics",
      metadata: { validated: true },
      providerKey: "posthog",
      state: {
        defaultTargetKey: "production",
        host: "https://us.posthog.com",
      },
      stateVersion: 2,
      status: "connected",
      tenantIntegrationId: "tenant-integration-1",
    });
  });
});
