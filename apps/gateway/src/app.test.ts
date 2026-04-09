import assert from "node:assert/strict"
import { describe, it } from "vitest"

import { createGatewayApp } from "./app"

describe("gateway app", () => {
  it("returns service health", async () => {
    const app = createGatewayApp()
    const response = await app.request("http://gateway.local/healthz")

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "gateway",
    })
  })

  it("rejects execute requests without runtime auth", async () => {
    const app = createGatewayApp()
    const response = await app.request(
      "http://gateway.local/api/internal/runtime/integrations/execute",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          arguments: {},
          commandKey: "slack.send_message",
          integrationKey: "slack",
        }),
      },
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: "Missing runtime bearer token",
    })
  })
})
