import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { isRuntimeDebugLoggingEnabled } from "./debug-logging"

describe("runtime debug logging", () => {
  it("is disabled by default", () => {
    assert.equal(isRuntimeDebugLoggingEnabled({}), false)
  })

  it("accepts explicit truthy runtime debug values", () => {
    for (const value of ["1", "true", "yes", "on", " TRUE "]) {
      assert.equal(
        isRuntimeDebugLoggingEnabled({
          OTTO_RUNTIME_DEBUG_LOGS: value,
        }),
        true,
      )
    }
  })

  it("rejects non-truthy runtime debug values", () => {
    for (const value of ["0", "false", "no", "off", "debug"]) {
      assert.equal(
        isRuntimeDebugLoggingEnabled({
          OTTO_RUNTIME_DEBUG_LOGS: value,
        }),
        false,
      )
    }
  })
})
