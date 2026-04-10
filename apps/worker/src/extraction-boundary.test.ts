import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { describe, it } from "vitest"

const appSourcePath = path.resolve(import.meta.dirname, "app.ts")
const dockerfilePath = path.resolve(import.meta.dirname, "../Dockerfile")
const workerRuntimeSourceRoot = path.resolve(import.meta.dirname, "../src/runtime")
const workerRuntimePackagePath = path.resolve(
  import.meta.dirname,
  "../../../packages/features/worker-runtime",
)

describe("worker extraction boundary", () => {
  it("does not import runtime code from legacy web/src", () => {
    const source = fs.readFileSync(appSourcePath, "utf8")

    assert.doesNotMatch(source, /\.\.\/\.\.\/\.\.\/web\/src/)
    assert.doesNotMatch(source, /legacy-control-plane-runtime/)
    assert.doesNotMatch(source, /@otto\/feature-worker-runtime/)
    assert.match(source, /\.\/runtime\//)
  })

  it("does not copy legacy web/src into the worker image", () => {
    const dockerfile = fs.readFileSync(dockerfilePath, "utf8")

    assert.doesNotMatch(dockerfile, /COPY web\/src web\/src/)
    assert.doesNotMatch(dockerfile, /\/app\/web\/src/)
    assert.doesNotMatch(dockerfile, /legacy-control-plane-runtime/)
    assert.doesNotMatch(dockerfile, /packages\/features\/worker-runtime/)
  })

  it("keeps the worker runtime package free of browser and next-specific imports", () => {
    const sourceFiles = fs
      .readdirSync(workerRuntimeSourceRoot, { recursive: true })
      .flatMap((entry) =>
        typeof entry === "string" && entry.endsWith(".ts")
          ? [path.join(workerRuntimeSourceRoot, entry.toString())]
          : [],
      )

    for (const filePath of sourceFiles) {
      const source = fs.readFileSync(filePath, "utf8")

      assert.doesNotMatch(source, /next\//, filePath)
      assert.doesNotMatch(source, /posthog-js/, filePath)
      assert.doesNotMatch(source, /tailwind-merge/, filePath)
      assert.doesNotMatch(source, /clsx/, filePath)
      assert.doesNotMatch(source, /NextResponse/, filePath)
    }
  })

  it("does not keep worker-only runtime code under packages", () => {
    assert.equal(fs.existsSync(workerRuntimePackagePath), false)
  })
})
