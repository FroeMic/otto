import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import {
  createIntegrationsOauthRouter,
  type IntegrationsOauthRouteDependencies,
} from "./oauth-routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): IntegrationsOauthRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    beginWorkspaceIntegrationOauth: async ({ orgSlug, providerKey }) => {
      return {
        authorizeUrl: `https://oauth.example.com/${providerKey}?org=${orgSlug}`,
      }
    },
    completeWorkspaceIntegrationOauth: async ({ providerKey }) => {
      return {
        redirectUrl: `https://getyourotto.com/otto/settings/agent/integrations/${providerKey}/status?${providerKey}_connected=1`,
      }
    },
  }
}

function createOauthTestApp(
  dependencies: IntegrationsOauthRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createIntegrationsOauthRouter(dependencies))
  return app
}

describe("integration oauth routes", () => {
  it("redirects managed integration start requests to the provider authorization URL", async () => {
    const app = createOauthTestApp()
    const response = await app.request(
      "https://api.getyourotto.com/oauth/start/integration/slack?orgSlug=otto",
      {
        redirect: "manual",
      },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://oauth.example.com/slack?org=otto",
    )
  })

  it("redirects onboarding-session starts back to login instead of supporting the legacy branch", async () => {
    const app = createOauthTestApp({
      ...createDependencies(),
      beginWorkspaceIntegrationOauth: async ({ orgSlug, providerKey }) => {
        return {
          authorizeUrl: orgSlug
            ? `https://oauth.example.com/${providerKey}?org=${orgSlug}`
            : `https://getyourotto.com/login?${providerKey}_error=Missing%20workspace%20slug.`,
        }
      },
    })
    const response = await app.request(
      "https://api.getyourotto.com/oauth/start/integration/slack?onboardingSessionId=session_123",
      {
        redirect: "manual",
      },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://getyourotto.com/login?slack_error=Missing%20workspace%20slug.",
    )
  })

  it("redirects managed integration callbacks back to the extracted settings route", async () => {
    const app = createOauthTestApp()
    const response = await app.request(
      "https://api.getyourotto.com/oauth/callback/integration/linear?code=code_123&state=signed_state",
      {
        redirect: "manual",
      },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://getyourotto.com/otto/settings/agent/integrations/linear/status?linear_connected=1",
    )
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createOauthTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "https://api.getyourotto.com/oauth/start/integration/slack?orgSlug=otto",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })
})
