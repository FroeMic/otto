import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { describe, it } from "vitest"

const legacyRoutesPath = path.resolve(import.meta.dirname, "legacy-routes.ts")
const runtimeCorePath = path.resolve(
  import.meta.dirname,
  "native/runtime-core.ts",
)

describe("api runtime extraction boundary", () => {
  it("no longer mounts legacy wrappers for native integration routes", () => {
    const source = fs.readFileSync(legacyRoutesPath, "utf8")

    assert.doesNotMatch(source, /\/api\/internal\/runtime\/integrations\b/)
    assert.doesNotMatch(
      source,
      /\/api\/internal\/runtime\/ai\/openai\/v1\/responses/,
    )
    assert.doesNotMatch(
      source,
      /\/api\/internal\/runtime\/ai\/openai\/v1\/audio\/transcriptions/,
    )
  })

  it("registers runtime integration routes natively in apps/api", () => {
    const source = fs.readFileSync(runtimeCorePath, "utf8")

    assert.match(source, /\/api\/internal\/runtime\/integrations/)
    assert.match(source, /\/api\/internal\/runtime\/web-search\/search/)
    assert.match(source, /proxyOpenAiResponsesRequest/)
  })
})
