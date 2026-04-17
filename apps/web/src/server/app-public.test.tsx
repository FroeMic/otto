import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import { createApp } from "./app"

const builtIntegrationRoot = fileURLToPath(
  new URL("../../dist/public/assets/integrations", import.meta.url),
)

describe("web public assets", () => {
  afterEach(() => {
    rmSync(builtIntegrationRoot, { force: true, recursive: true })
  })

  const app = createApp({
    API_ORIGIN: "http://api.internal",
    FRONTEND_PORT: 4100,
    NEXT_PUBLIC_POSTHOG_ENABLED: false,
    NEXT_PUBLIC_POSTHOG_HOST: "/ingest",
    NODE_ENV: "test",
    POSTHOG_ASSET_PROXY_TARGET: "https://eu-assets.i.posthog.com",
    POSTHOG_PROXY_TARGET: "https://eu.i.posthog.com",
    WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
  })

  it("serves the Otto avatar asset from the public root", async () => {
    const response = await app.request("http://localhost/otto-avatar.svg")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("<svg")
    expect(text).toContain("shape-rendering=\"crispEdges\"")
  })

  it("serves integration icons from the built public asset root", async () => {
    mkdirSync(builtIntegrationRoot, { recursive: true })
    const fileName = "test-built-icon.svg"
    writeFileSync(
      `${builtIntegrationRoot}/${fileName}`,
      "<svg><title>built slack icon</title></svg>",
      "utf8",
    )

    const response = await app.request(`http://localhost/integrations/${fileName}`)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("built slack icon")
  })
})
