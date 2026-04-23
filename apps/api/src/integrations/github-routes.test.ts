import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it, vi } from "vitest"

import {
  createGitHubAppRouter,
  type GitHubAppRouteDependencies,
} from "./github-routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): GitHubAppRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    beginGitHubAppInstall: async ({ orgSlug, userExternalId }) => ({
      installUrl: `https://github.com/apps/workspace-assistant/installations/new?state=${orgSlug}.${userExternalId}`,
    }),
    completeGitHubAppSetup: async ({ installationId }) => ({
      accountLogin: "acme",
      installationId,
      orgSlug: "acme",
      repositoryCount: 1,
    }),
  }
}

function createTestApp(
  dependencies: GitHubAppRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createGitHubAppRouter(dependencies))

  return app
}

describe("GitHub App routes", () => {
  it("starts installation by redirecting to the GitHub App install URL", async () => {
    const beginGitHubAppInstall = vi.fn<
      GitHubAppRouteDependencies["beginGitHubAppInstall"]
    >(createDependencies().beginGitHubAppInstall)
    const app = createTestApp({
      ...createDependencies(),
      beginGitHubAppInstall,
    })

    const response = await app.request(
      "http://api.local/api/workspace/acme/integrations/github/install/start",
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("Location"),
      "https://github.com/apps/workspace-assistant/installations/new?state=acme.user_123",
    )
    assert.deepEqual(beginGitHubAppInstall.mock.calls[0]?.[0], {
      orgSlug: "acme",
      userExternalId: "user_123",
    })
  })

  it("completes setup and redirects back to the workspace integration page", async () => {
    const completeGitHubAppSetup = vi.fn<
      GitHubAppRouteDependencies["completeGitHubAppSetup"]
    >(createDependencies().completeGitHubAppSetup)
    const app = createTestApp({
      ...createDependencies(),
      completeGitHubAppSetup,
    })

    const response = await app.request(
      "http://api.local/api/integrations/github/setup/callback?installation_id=987&setup_action=install&state=signed-state",
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("Location"),
      "/acme/settings/agent/integrations/github/status?github_connected=1",
    )
    assert.deepEqual(completeGitHubAppSetup.mock.calls[0]?.[0], {
      installationId: "987",
      setupAction: "install",
      state: "signed-state",
      userExternalId: "user_123",
    })
  })

  it("returns authentication errors on protected routes", async () => {
    const app = createTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Sign in first",
        )
      },
    })

    const response = await app.request(
      "http://api.local/api/workspace/acme/integrations/github/install/start",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Sign in first",
    })
  })
})
