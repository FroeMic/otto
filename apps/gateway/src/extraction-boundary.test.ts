import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { describe, it } from "vitest"

const appSourcePath = path.resolve(import.meta.dirname, "app.ts")
const dockerfilePath = path.resolve(import.meta.dirname, "../Dockerfile")

describe("gateway extraction boundary", () => {
  it("does not import runtime code from legacy web/src", () => {
    const source = fs.readFileSync(appSourcePath, "utf8")

    assert.doesNotMatch(source, /\.\.\/\.\.\/\.\.\/web\/src/)
  })

  it("does not import runtime code from the legacy compatibility package", () => {
    const source = fs.readFileSync(appSourcePath, "utf8")

    assert.doesNotMatch(source, /legacy-control-plane-runtime/)
  })

  it("does not copy legacy web/src into the gateway image", () => {
    const dockerfile = fs.readFileSync(dockerfilePath, "utf8")

    assert.doesNotMatch(dockerfile, /COPY web\/src web\/src/)
    assert.doesNotMatch(dockerfile, /\/app\/web\/src/)
  })

  it("does not copy the legacy compatibility package into the gateway image", () => {
    const dockerfile = fs.readFileSync(dockerfilePath, "utf8")

    assert.doesNotMatch(dockerfile, /legacy-control-plane-runtime/)
  })
})
