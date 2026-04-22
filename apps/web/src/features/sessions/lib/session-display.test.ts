import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { formatSessionName } from "./session-display"

describe("formatSessionName", () => {
  it("names the legacy main session as the heartbeat session", () => {
    assert.equal(
      formatSessionName({
        sessionKey: "agent:main:main",
      }),
      "Heartbeat Session",
    )
  })
})
