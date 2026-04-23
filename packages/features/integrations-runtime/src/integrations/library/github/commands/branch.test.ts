import assert from "node:assert/strict"
import { beforeEach, describe, it, vi } from "vitest"

const getEnabledGitHubRepositoryDetailsForTenantIntegration = vi.fn()
const githubJsonRequest = vi.fn()

vi.mock("../../../../db/github-installations", () => ({
  getEnabledGitHubRepositoryDetailsForTenantIntegration,
}))

vi.mock("../client", () => ({
  encodeGitHubPathSegment: encodeURIComponent,
  encodeGitHubRefPath: (value: string) =>
    value.split("/").map(encodeURIComponent).join("/"),
  githubJsonRequest,
}))

const auth = {
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
  kind: "github_app_installation" as const,
  permissions: {},
  repositorySelection: "selected",
  suspendedAt: null,
  tenantIntegrationId: "tenant-integration-1",
}

const repository = {
  archived: false,
  defaultBranch: "main",
  disabled: false,
  fullName: "acme/web-app",
  githubRepositoryId: "123",
  isPrivate: true,
  name: "web-app",
  ownerLogin: "acme",
  selectedByInstallation: true,
}

describe("GitHub branch commands", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getEnabledGitHubRepositoryDetailsForTenantIntegration.mockResolvedValue(
      repository,
    )
  })

  it("lists remote branches for a selected repository", async () => {
    githubJsonRequest.mockResolvedValue([
      {
        commit: {
          sha: "abc123",
        },
        name: "main",
        protected: true,
      },
    ])

    const { executeGitHubBranchListRemote } = await import("./branch")
    const result = await executeGitHubBranchListRemote({
      arguments: {
        limit: 10,
        owner: "acme",
        repo: "web-app",
      },
      context: {
        auth,
        tenantIntegrationId: "tenant-integration-1",
      },
    })

    assert.deepEqual(result, {
      branches: [
        {
          commitSha: "abc123",
          name: "main",
          protected: true,
        },
      ],
      repository,
      total: 1,
    })
    assert.deepEqual(githubJsonRequest.mock.calls[0]?.[0], {
      auth,
      method: "GET",
      path: "/repos/acme/web-app/branches?per_page=10",
    })
  })

  it("gets one remote branch for a selected repository", async () => {
    githubJsonRequest.mockResolvedValue({
      commit: {
        sha: "abc123",
      },
      name: "feature/demo",
      protected: false,
    })

    const { executeGitHubBranchGetRemote } = await import("./branch")
    const result = await executeGitHubBranchGetRemote({
      arguments: {
        branch: "feature/demo",
        owner: "acme",
        repo: "web-app",
      },
      context: {
        auth,
        tenantIntegrationId: "tenant-integration-1",
      },
    })

    assert.deepEqual(result, {
      branch: {
        commitSha: "abc123",
        name: "feature/demo",
        protected: false,
      },
      repository,
    })
    assert.equal(
      githubJsonRequest.mock.calls[0]?.[0].path,
      "/repos/acme/web-app/branches/feature%2Fdemo",
    )
  })

  it("deletes a non-default remote branch for a selected repository", async () => {
    githubJsonRequest.mockResolvedValue(null)

    const { executeGitHubBranchDeleteRemote } = await import("./branch")
    const result = await executeGitHubBranchDeleteRemote({
      arguments: {
        branch: "feature/demo",
        owner: "acme",
        repo: "web-app",
      },
      context: {
        auth,
        tenantIntegrationId: "tenant-integration-1",
      },
    })

    assert.deepEqual(result, {
      branch: "feature/demo",
      deleted: true,
      repository,
    })
    assert.equal(
      githubJsonRequest.mock.calls[0]?.[0].path,
      "/repos/acme/web-app/git/refs/heads/feature/demo",
    )
  })

  it("refuses to delete the default branch", async () => {
    const { executeGitHubBranchDeleteRemote } = await import("./branch")

    await assert.rejects(
      executeGitHubBranchDeleteRemote({
        arguments: {
          branch: "main",
          owner: "acme",
          repo: "web-app",
        },
        context: {
          auth,
          tenantIntegrationId: "tenant-integration-1",
        },
      }),
      /cannot delete the default branch/,
    )
    assert.equal(githubJsonRequest.mock.calls.length, 0)
  })
})
