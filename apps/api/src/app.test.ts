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
})
