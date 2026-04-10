import assert from "node:assert/strict"

import { afterEach, describe, it, vi } from "vitest"

import { createApiApp } from "./app"

describe("api app", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns service health", async () => {
    const app = createApiApp()
    const response = await app.request("http://api.local/healthz")

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "api",
    })
  })

  it("logs incoming requests", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const app = createApiApp()

    const response = await app.request("http://api.local/healthz")

    assert.equal(response.status, 200)
    assert.equal(logSpy.mock.calls.length > 0, true)
  })

  it("returns not found for unknown routes", async () => {
    const app = createApiApp()
    const response = await app.request("http://api.local/not-found")

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: "Not found",
    })
  })

  it("exposes runtime web search natively", async () => {
    const app = createApiApp()
    const response = await app.request(
      "http://api.local/api/internal/runtime/web-search/search",
      {
        body: JSON.stringify({ query: "otto" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: "Missing runtime bearer token",
    })
  })

  it("exposes runtime integration settings natively", async () => {
    const app = createApiApp()
    const response = await app.request(
      "http://api.local/api/internal/runtime/integrations/slack/settings",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "unauthorized",
      message: "Missing runtime bearer token",
    })
  })

  it("exposes workos webhooks natively", async () => {
    const app = createApiApp()
    const response = await app.request("http://api.local/webhooks/workos", {
      body: JSON.stringify({ event: "organization.updated" }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    assert.equal(response.status, 501)
    assert.deepEqual(await response.json(), {
      error: "WorkOS webhook secret is not configured",
      ok: false,
    })
  })

  it("exposes stripe webhooks natively", async () => {
    const app = createApiApp()
    const response = await app.request("http://api.local/webhooks/stripe", {
      body: JSON.stringify({ type: "invoice.paid" }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: "Missing Stripe signature header.",
    })
  })

  it("exposes user profile update natively", async () => {
    const app = createApiApp({
      userRoutes: {
        authenticateWorkspaceUser: async () => ({
          email: "michael@getyourotto.com",
          firstName: "Michael",
          id: "user_123",
          lastName: "Frohlich",
        }),
        getConnectedAccounts: async () => [],
        getUserProfile: async () => ({
          email: "michael@getyourotto.com",
          firstName: "Michael",
          lastName: "Frohlich",
        }),
        updateUserProfile: async ({ firstName, lastName }) => ({
          email: "michael@getyourotto.com",
          firstName,
          lastName,
        }),
      },
    })
    const response = await app.request("http://api.local/api/user/profile", {
      body: JSON.stringify({
        firstName: "Michael",
        lastName: "Otto",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      email: "michael@getyourotto.com",
      firstName: "Michael",
      lastName: "Otto",
      name: "Michael Otto",
    })
  })

  it("exposes connected accounts natively", async () => {
    const app = createApiApp({
      userRoutes: {
        authenticateWorkspaceUser: async () => ({
          email: "michael@getyourotto.com",
          firstName: "Michael",
          id: "user_123",
          lastName: "Frohlich",
        }),
        getConnectedAccounts: async () => [
          {
            avatarUrl: null,
            displayName: "michael",
            externalId: "U123",
            fullName: "Michael Frohlich",
            id: "identity_1",
            provider: "slack",
            username: "michael",
          },
        ],
        getUserProfile: async () => ({
          email: "michael@getyourotto.com",
          firstName: "Michael",
          lastName: "Frohlich",
        }),
        updateUserProfile: async ({ firstName, lastName }) => ({
          email: "michael@getyourotto.com",
          firstName,
          lastName,
        }),
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/connected-accounts",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      connectedAccounts: [
        {
          avatarUrl: null,
          displayName: "michael",
          externalId: "U123",
          fullName: "Michael Frohlich",
          id: "identity_1",
          provider: "slack",
          username: "michael",
        },
      ],
    })
  })
})
