import assert from "node:assert/strict"
import { beforeEach, describe, it, vi } from "vitest"

const listEnabledGitHubRepositoriesForTenantIntegration = vi.fn()
const getEnabledGitHubRepositoryDetailsForTenantIntegration = vi.fn()
const searchEnabledGitHubRepositoriesForTenantIntegration = vi.fn()

vi.mock("../../../../db/github-installations", () => ({
  getEnabledGitHubRepositoryDetailsForTenantIntegration,
  listEnabledGitHubRepositoriesForTenantIntegration,
  searchEnabledGitHubRepositoriesForTenantIntegration,
}))

describe("GitHub repository commands", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("lists enabled repositories for the connected GitHub installation", async () => {
    listEnabledGitHubRepositoriesForTenantIntegration.mockResolvedValue([
      {
        archived: false,
        defaultBranch: "main",
        disabled: false,
        fullName: "acme/web-app",
        githubRepositoryId: "123",
        isPrivate: true,
        name: "web-app",
        ownerLogin: "acme",
        selectedByInstallation: true,
      },
    ])

    const { executeGitHubRepositoryList } = await import("./repository")
    const result = await executeGitHubRepositoryList({
      arguments: {
        limit: 10,
      },
      context: {
        auth: {
          accessToken: undefined as never,
          accountLogin: "acme",
          accountType: "Organization",
          apiKey: undefined as never,
          appId: "123",
          appSlug: "workspace-assistant",
          events: [],
          getAccessToken: async () => ({
            expiresAt: "2026-04-23T12:00:00.000Z",
            permissions: {},
            repositorySelection: "selected",
            token: "token",
          }),
          installationId: "987",
          kind: "github_app_installation",
          permissions: {},
          repositorySelection: "selected",
          suspendedAt: null,
          tenantIntegrationId: "tenant-integration-1",
        },
        tenantIntegrationId: "tenant-integration-1",
      },
    })

    assert.deepEqual(result, {
      repositories: [
        {
          archived: false,
          defaultBranch: "main",
          disabled: false,
          fullName: "acme/web-app",
          githubRepositoryId: "123",
          isPrivate: true,
          name: "web-app",
          ownerLogin: "acme",
          selectedByInstallation: true,
        },
      ],
      total: 1,
    })
    assert.deepEqual(
      listEnabledGitHubRepositoriesForTenantIntegration.mock.calls[0]?.[0],
      {
        limit: 10,
        tenantIntegrationId: "tenant-integration-1",
      },
    )
  })

  it("gets one enabled repository for the connected GitHub installation", async () => {
    getEnabledGitHubRepositoryDetailsForTenantIntegration.mockResolvedValue({
      archived: false,
      defaultBranch: "main",
      disabled: false,
      fullName: "acme/web-app",
      githubRepositoryId: "123",
      isPrivate: true,
      name: "web-app",
      ownerLogin: "acme",
      selectedByInstallation: true,
    })

    const { executeGitHubRepositoryGet } = await import("./repository")
    const result = await executeGitHubRepositoryGet({
      arguments: {
        owner: "acme",
        repo: "web-app",
      },
      context: {
        auth: {
          accessToken: undefined as never,
          accountLogin: "acme",
          accountType: "Organization",
          apiKey: undefined as never,
          appId: "123",
          appSlug: "workspace-assistant",
          events: [],
          getAccessToken: async () => ({
            expiresAt: "2026-04-23T12:00:00.000Z",
            permissions: {},
            repositorySelection: "selected",
            token: "token",
          }),
          installationId: "987",
          kind: "github_app_installation",
          permissions: {},
          repositorySelection: "selected",
          suspendedAt: null,
          tenantIntegrationId: "tenant-integration-1",
        },
        tenantIntegrationId: "tenant-integration-1",
      },
    })

    assert.deepEqual(result, {
      repository: {
        archived: false,
        defaultBranch: "main",
        disabled: false,
        fullName: "acme/web-app",
        githubRepositoryId: "123",
        isPrivate: true,
        name: "web-app",
        ownerLogin: "acme",
        selectedByInstallation: true,
      },
    })
    assert.deepEqual(
      getEnabledGitHubRepositoryDetailsForTenantIntegration.mock.calls[0]?.[0],
      {
        owner: "acme",
        repo: "web-app",
        tenantIntegrationId: "tenant-integration-1",
      },
    )
  })

  it("searches enabled repositories for the connected GitHub installation", async () => {
    searchEnabledGitHubRepositoriesForTenantIntegration.mockResolvedValue([
      {
        archived: false,
        defaultBranch: "main",
        disabled: false,
        fullName: "acme/web-app",
        githubRepositoryId: "123",
        isPrivate: true,
        name: "web-app",
        ownerLogin: "acme",
        selectedByInstallation: true,
      },
    ])

    const { executeGitHubRepositorySearch } = await import("./repository")
    const result = await executeGitHubRepositorySearch({
      arguments: {
        limit: 10,
        query: "web",
      },
      context: {
        auth: {
          accessToken: undefined as never,
          accountLogin: "acme",
          accountType: "Organization",
          apiKey: undefined as never,
          appId: "123",
          appSlug: "workspace-assistant",
          events: [],
          getAccessToken: async () => ({
            expiresAt: "2026-04-23T12:00:00.000Z",
            permissions: {},
            repositorySelection: "selected",
            token: "token",
          }),
          installationId: "987",
          kind: "github_app_installation",
          permissions: {},
          repositorySelection: "selected",
          suspendedAt: null,
          tenantIntegrationId: "tenant-integration-1",
        },
        tenantIntegrationId: "tenant-integration-1",
      },
    })

    assert.deepEqual(result, {
      repositories: [
        {
          archived: false,
          defaultBranch: "main",
          disabled: false,
          fullName: "acme/web-app",
          githubRepositoryId: "123",
          isPrivate: true,
          name: "web-app",
          ownerLogin: "acme",
          selectedByInstallation: true,
        },
      ],
      total: 1,
    })
    assert.deepEqual(
      searchEnabledGitHubRepositoriesForTenantIntegration.mock.calls[0]?.[0],
      {
        limit: 10,
        query: "web",
        tenantIntegrationId: "tenant-integration-1",
      },
    )
  })
})
