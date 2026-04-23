import assert from "node:assert/strict"
import { beforeEach, describe, it, vi } from "vitest"

const getEnabledGitHubRepositoryDetailsForTenantIntegration = vi.fn()
const githubJsonRequest = vi.fn()

vi.mock("../../../../db/github-installations", () => ({
  getEnabledGitHubRepositoryDetailsForTenantIntegration,
}))

vi.mock("../client", () => ({
  encodeGitHubPathSegment: encodeURIComponent,
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

const context = {
  auth,
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

const pullRequest = {
  base: {
    ref: "main",
  },
  body: "Body",
  draft: false,
  head: {
    ref: "feature/demo",
    sha: "abc123",
  },
  html_url: "https://github.com/acme/web-app/pull/7",
  id: 77,
  node_id: "PR_kw123",
  number: 7,
  state: "open",
  title: "Demo",
  user: {
    login: "michael",
  },
}

describe("GitHub pull request commands", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getEnabledGitHubRepositoryDetailsForTenantIntegration.mockResolvedValue(
      repository,
    )
  })

  it("lists pull requests for a selected repository", async () => {
    githubJsonRequest.mockResolvedValue([pullRequest])

    const { executeGitHubPullRequestList } = await import("./pull-request")
    const result = await executeGitHubPullRequestList({
      arguments: {
        limit: 10,
        owner: "acme",
        repo: "web-app",
        state: "all",
      },
      context,
    })

    assert.deepEqual(result, {
      pullRequests: [
        {
          authorLogin: "michael",
          baseRef: "main",
          body: "Body",
          draft: false,
          headRef: "feature/demo",
          headSha: "abc123",
          htmlUrl: "https://github.com/acme/web-app/pull/7",
          id: 77,
          nodeId: "PR_kw123",
          number: 7,
          state: "open",
          title: "Demo",
        },
      ],
      repository,
      total: 1,
    })
    assert.equal(
      githubJsonRequest.mock.calls[0]?.[0].path,
      "/repos/acme/web-app/pulls?state=all&per_page=10",
    )
  })

  it("creates a pull request", async () => {
    githubJsonRequest.mockResolvedValue(pullRequest)

    const { executeGitHubPullRequestCreate } = await import("./pull-request")
    await executeGitHubPullRequestCreate({
      arguments: {
        base: "main",
        body: "Body",
        draft: true,
        head: "feature/demo",
        owner: "acme",
        repo: "web-app",
        title: "Demo",
      },
      context,
    })

    assert.deepEqual(githubJsonRequest.mock.calls[0]?.[0], {
      auth,
      body: {
        base: "main",
        body: "Body",
        draft: true,
        head: "feature/demo",
        title: "Demo",
      },
      method: "POST",
      path: "/repos/acme/web-app/pulls",
    })
  })

  it("comments on a pull request", async () => {
    githubJsonRequest.mockResolvedValue({ id: 123 })

    const { executeGitHubPullRequestComment } = await import("./pull-request")
    const result = await executeGitHubPullRequestComment({
      arguments: {
        body: "Looks good",
        number: 7,
        owner: "acme",
        repo: "web-app",
      },
      context,
    })

    assert.deepEqual(result, {
      comment: { id: 123 },
      repository,
    })
    assert.equal(
      githubJsonRequest.mock.calls[0]?.[0].path,
      "/repos/acme/web-app/issues/7/comments",
    )
  })

  it("marks a pull request ready for review through GraphQL", async () => {
    githubJsonRequest
      .mockResolvedValueOnce(pullRequest)
      .mockResolvedValueOnce({ data: { ok: true } })

    const { executeGitHubPullRequestMarkReadyForReview } = await import(
      "./pull-request"
    )
    const result = await executeGitHubPullRequestMarkReadyForReview({
      arguments: {
        number: 7,
        owner: "acme",
        repo: "web-app",
      },
      context,
    })

    assert.equal(githubJsonRequest.mock.calls[0]?.[0].path, "/repos/acme/web-app/pulls/7")
    assert.equal(githubJsonRequest.mock.calls[1]?.[0].path, "/graphql")
    assert.match(
      githubJsonRequest.mock.calls[1]?.[0].body.query,
      /markPullRequestReadyForReview/,
    )
    assert.deepEqual((result as { repository: unknown }).repository, repository)
  })

  it("merges a pull request and lets GitHub merge errors propagate", async () => {
    githubJsonRequest.mockResolvedValue({
      merged: true,
      message: "Pull Request successfully merged",
      sha: "def456",
    })

    const { executeGitHubPullRequestMerge } = await import("./pull-request")
    const result = await executeGitHubPullRequestMerge({
      arguments: {
        mergeMethod: "squash",
        number: 7,
        owner: "acme",
        repo: "web-app",
      },
      context,
    })

    assert.deepEqual(result, {
      merge: {
        merged: true,
        message: "Pull Request successfully merged",
        sha: "def456",
      },
      repository,
    })
    assert.deepEqual(githubJsonRequest.mock.calls[0]?.[0], {
      auth,
      body: {
        commit_message: undefined,
        commit_title: undefined,
        merge_method: "squash",
        sha: undefined,
      },
      method: "PUT",
      path: "/repos/acme/web-app/pulls/7/merge",
    })
  })
})
