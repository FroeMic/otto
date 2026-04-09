import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createApiApp } from "./app"
import type { LegacyRouteDefinition } from "./legacy-routes"

describe("api app", () => {
  it("returns service health", async () => {
    const app = createApiApp()
    const response = await app.request("http://api.local/healthz")

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "api",
    })
  })

  it("returns not found for unknown routes", async () => {
    const app = createApiApp()
    const response = await app.request("http://api.local/not-found")

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: "Not found",
    })
  })

  it("adapts legacy-style routes that expect nextUrl", async () => {
    const app = createApiApp([
      {
        exportName: "GET",
        honoPath: "/auth-fixture",
        legacyModulePath: "./test-fixtures/next-request-route",
        requestMode: "next-request",
      } satisfies LegacyRouteDefinition,
    ])
    const response = await app.request(
      "http://api.local/auth-fixture?returnTo=/workspace",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      pathname: "/auth-fixture",
      returnTo: "/workspace",
    })
  })

  it("adapts a legacy-style route module", async () => {
    const app = createApiApp([
      {
        exportName: "GET",
        honoPath: "/fixtures/:id",
        legacyModulePath: "./test-fixtures/echo-route",
      } satisfies LegacyRouteDefinition,
    ])
    const response = await app.request(
      "http://api.local/fixtures/demo?search=otto",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      id: "demo",
      search: "otto",
    })
  })
})
