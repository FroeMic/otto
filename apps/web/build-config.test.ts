import { describe, expect, it } from "vitest"

import config from "./vite.config"

describe("web build config", () => {
  it("replaces process.env.NODE_ENV in the browser build", () => {
    expect(config.define).toMatchObject({
      "process.env.NODE_ENV": JSON.stringify("production"),
    })
  })

  it("emits entry assets under /assets", () => {
    expect(config.build).toMatchObject({
      outDir: expect.stringContaining("dist/public"),
    })

    const output = config.build?.rollupOptions?.output

    if (!output || Array.isArray(output)) {
      throw new Error("Expected a single Rollup output config.")
    }

    expect(output.entryFileNames?.({ name: "landing" })).toBe(
      "assets/landing.js",
    )
    expect(output.entryFileNames?.({ name: "workspace" })).toBe(
      "assets/workspace.js",
    )
    expect(
      output.assetFileNames?.({
        name: "styles.css",
        names: ["styles.css"],
        originalFileNames: [],
        source: "",
        type: "asset",
      }),
    ).toBe("assets/workspace.css")
  })
})
