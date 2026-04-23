import assert from "node:assert/strict"
import { describe, it } from "vitest"

import {
  createGitHubGitAccessForTenant,
  GitHubGitAccessError,
} from "./github-git-access"

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

const installation = {
  accountLogin: "acme",
  accountType: "Organization",
  appId: "123",
  appSlug: "workspace-assistant",
  events: [],
  installationId: "987",
  permissions: {},
  repositorySelection: "selected",
  suspendedAt: null,
  tenantIntegrationId: "tenant-integration-1",
}

describe("GitHub git access runtime helper", () => {
  it("mints short-lived git access for a selected repository", async () => {
    const result = await createGitHubGitAccessForTenant({
      body: {
        owner: "acme",
        repo: "web-app",
      },
      createAccessToken: async () => ({
        expiresAt: "2026-04-23T12:00:00.000Z",
        token: "installation-token",
      }),
      getInstallation: async () => installation,
      getRepository: async () => repository,
      getTenantIntegrationId: async () => "tenant-integration-1",
      tenantId: "tenant-1",
    })

    assert.deepEqual(result, {
      cloneUrl: "https://github.com/acme/web-app.git",
      defaultBranch: "main",
      expiresAt: "2026-04-23T12:00:00.000Z",
      fullName: "acme/web-app",
      owner: "acme",
      repo: "web-app",
      token: "installation-token",
    })
  })

  it("rejects repositories outside the selected workspace set", async () => {
    await assert.rejects(
      createGitHubGitAccessForTenant({
        body: {
          owner: "acme",
          repo: "web-app",
        },
        getInstallation: async () => installation,
        getRepository: async () => null,
        getTenantIntegrationId: async () => "tenant-integration-1",
        tenantId: "tenant-1",
      }),
      (error) => {
        assert.ok(error instanceof GitHubGitAccessError)
        assert.equal(error.status, 403)
        return true
      },
    )
  })

  it("rejects unsafe owner and repository names", async () => {
    await assert.rejects(
      createGitHubGitAccessForTenant({
        body: {
          owner: "../acme",
          repo: "web-app",
        },
        getTenantIntegrationId: async () => "tenant-integration-1",
        tenantId: "tenant-1",
      }),
      (error) => {
        assert.ok(error instanceof GitHubGitAccessError)
        assert.equal(error.status, 400)
        return true
      },
    )
  })
})
