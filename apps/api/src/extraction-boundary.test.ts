import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { describe, it } from "vitest"

const appPath = path.resolve(import.meta.dirname, "app.ts")
const runtimeRoutesPath = path.resolve(import.meta.dirname, "runtime/routes.ts")
const tsconfigPath = path.resolve(import.meta.dirname, "../tsconfig.json")
const viteConfigPath = path.resolve(import.meta.dirname, "../vite.config.ts")

describe("api runtime extraction boundary", () => {
  it("does not mount legacy route adapters or compatibility proxy routes", () => {
    const source = fs.readFileSync(appPath, "utf8")

    assert.doesNotMatch(source, /legacy-routes/)
    assert.doesNotMatch(source, /registerCompatibilityProxyRoutes/)
  })

  it("registers runtime and webhook routes natively in apps/api", () => {
    const source = fs.readFileSync(runtimeRoutesPath, "utf8")

    assert.match(source, /\/api\/internal\/runtime\/integrations/)
    assert.match(source, /\/api\/internal\/runtime\/web-search\/search/)
    assert.match(source, /\/api\/internal\/runtime\/managed-config/)
    assert.match(source, /\/api\/internal\/runtime\/managed-skills/)
    assert.match(source, /proxyOpenAiResponsesRequest/)
    assert.match(source, /\/api\/internal\/runtime\/sessions\/sync/)
    assert.match(source, /\/api\/internal\/runtime\/scheduled-tasks\/sync/)
    assert.match(source, /\/webhooks\/workos/)
    assert.match(source, /\/webhooks\/stripe/)
  })

  it("does not import runtime code from legacy web sources", () => {
    const source = fs.readFileSync(runtimeRoutesPath, "utf8")

    assert.doesNotMatch(source, /web\/src/)
  })

  it("does not keep api build aliases pointed at legacy web sources", () => {
    const tsconfigSource = fs.readFileSync(tsconfigPath, "utf8")
    const viteConfigSource = fs.readFileSync(viteConfigPath, "utf8")

    assert.doesNotMatch(tsconfigSource, /web\/src/)
    assert.doesNotMatch(viteConfigSource, /web\/src/)
  })
})
