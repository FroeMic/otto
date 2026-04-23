import assert from "node:assert/strict"
import { beforeEach, describe, it, vi } from "vitest"

const getDb = vi.fn()

vi.mock("./client", () => ({
  getDb,
}))

describe("GitHub installation state", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("upserts GitHub App installation metadata", async () => {
    const values: Record<string, unknown>[] = []
    const insertBuilder = {
      onConflictDoUpdate: vi.fn(() => insertBuilder),
      returning: vi.fn(() => Promise.resolve([{ id: "github-install-1" }])),
      values: vi.fn((nextValues: Record<string, unknown>) => {
        values.push(nextValues)
        return insertBuilder
      }),
    }
    getDb.mockReturnValue({
      insert: vi.fn(() => insertBuilder),
    })

    const { upsertGitHubInstallationForTenantIntegration } = await import(
      "./github-installations"
    )

    const id = await upsertGitHubInstallationForTenantIntegration({
      accountId: "42",
      accountLogin: "acme",
      accountType: "Organization",
      appId: "123",
      appSlug: "otto-dev",
      events: ["pull_request", "push"],
      installationId: "987",
      permissions: {
        contents: "write",
        pull_requests: "write",
      },
      repositorySelection: "selected",
      tenantId: "tenant-1",
      tenantIntegrationId: "tenant-integration-1",
    })

    assert.equal(id, "github-install-1")
    assert.equal(values.length, 1)
    assert.deepEqual(values[0], {
      accountId: "42",
      accountLogin: "acme",
      accountType: "Organization",
      appId: "123",
      appSlug: "otto-dev",
      eventsJson: ["pull_request", "push"],
      installationId: "987",
      lastSyncedAt: null,
      permissionsJson: {
        contents: "write",
        pull_requests: "write",
      },
      repositorySelection: "selected",
      suspendedAt: null,
      tenantId: "tenant-1",
      tenantIntegrationId: "tenant-integration-1",
      updatedAt: values[0]?.updatedAt,
    })
    assert.ok(values[0]?.updatedAt instanceof Date)
  })

  it("returns only enabled repositories for a connected installation", async () => {
    const selectBuilder = {
      from: vi.fn(() => selectBuilder),
      innerJoin: vi.fn(() => selectBuilder),
      limit: vi.fn(() =>
        Promise.resolve([
          {
            accountLogin: "acme",
            appId: "123",
            installationId: "987",
            repositoryId: "repo-row-1",
            repositoryOwner: "acme",
            repositoryName: "web-app",
          },
        ]),
      ),
      where: vi.fn(() => selectBuilder),
    }
    getDb.mockReturnValue({
      select: vi.fn(() => selectBuilder),
    })

    const { getEnabledGitHubRepositoryForTenantIntegration } = await import(
      "./github-installations"
    )

    const repository = await getEnabledGitHubRepositoryForTenantIntegration({
      owner: "Acme",
      repo: "Web-App",
      tenantIntegrationId: "tenant-integration-1",
    })

    assert.deepEqual(repository, {
      accountLogin: "acme",
      appId: "123",
      installationId: "987",
      repositoryId: "repo-row-1",
      repositoryName: "web-app",
      repositoryOwner: "acme",
    })
  })
})
