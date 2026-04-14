import { describe, expect, it } from "vitest"

import { createApp } from "./app"

describe("web public assets", () => {
  const app = createApp({
    API_ORIGIN: "http://api.internal",
    FRONTEND_PORT: 4100,
    NODE_ENV: "test",
    WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
  })

  it("serves the Otto avatar asset from the public root", async () => {
    const response = await app.request("http://localhost/otto-avatar.svg")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("<svg")
    expect(text).toContain("shape-rendering=\"crispEdges\"")
  })
})
