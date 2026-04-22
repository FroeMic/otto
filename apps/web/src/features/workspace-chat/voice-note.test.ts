import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { isTranscribableMediaMimeType } from "./voice-note"

describe("workspace chat voice note helpers", () => {
  it("classifies uploaded audio and video files as transcribable media", () => {
    assert.equal(isTranscribableMediaMimeType("audio/x-m4a"), true)
    assert.equal(isTranscribableMediaMimeType("video/mp4"), true)
    assert.equal(isTranscribableMediaMimeType("text/plain"), false)
    assert.equal(isTranscribableMediaMimeType("application/pdf"), false)
  })
})
