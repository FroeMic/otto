import { describe, expect, it } from "vitest"

import config from "./vite.config"

describe("frontend build config", () => {
  it("replaces process.env.NODE_ENV in the browser build", () => {
    expect(config.define).toMatchObject({
      "process.env.NODE_ENV": JSON.stringify("production"),
    })
  })
})
