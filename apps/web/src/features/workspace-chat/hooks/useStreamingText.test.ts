import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  getNextStreamingTextFrame,
  getStreamingTextStepSize,
} from "./useStreamingText"

describe("workspace chat streaming text helpers", () => {
  it("advances one character at a time for very small backlogs", () => {
    assert.equal(getStreamingTextStepSize(1), 1)
    assert.equal(getStreamingTextStepSize(4), 1)
  })

  it("accelerates catch-up when the backlog is larger", () => {
    assert.equal(getStreamingTextStepSize(8), 2)
    assert.equal(getStreamingTextStepSize(24), 3)
    assert.equal(getStreamingTextStepSize(120), 12)
  })

  it("grows the visible text toward the canonical target while streaming", () => {
    assert.equal(
      getNextStreamingTextFrame({
        displayText: "Ot",
        status: "streaming",
        targetText: "Otto is replying",
      }),
      "Otto ",
    )
  })

  it("snaps to the canonical target when the text diverges", () => {
    assert.equal(
      getNextStreamingTextFrame({
        displayText: "Hello there",
        status: "streaming",
        targetText: "Goodbye",
      }),
      "Goodbye",
    )
  })

  it("flushes to the canonical target once streaming is over", () => {
    assert.equal(
      getNextStreamingTextFrame({
        displayText: "Otto is",
        status: "completed",
        targetText: "Otto is done",
      }),
      "Otto is done",
    )
  })
})
