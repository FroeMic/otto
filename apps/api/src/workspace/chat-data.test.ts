import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildWorkspaceChatMessagePreview,
  mapWorkspaceChatMessagePartRecord,
} from "./chat-data"

describe("workspace chat data helpers", () => {
  it("builds a preview from the first text part", () => {
    const preview = buildWorkspaceChatMessagePreview([
      {
        text: "Summarize the quarterly update.",
        type: "text" as const,
      },
    ])

    assert.equal(preview, "Summarize the quarterly update.")
  })

  it("falls back to a file label when no text part exists", () => {
    const preview = buildWorkspaceChatMessagePreview([
      {
        attachmentId: "att_1",
        fileName: "notes.pdf",
        mimeType: "application/pdf",
        type: "file" as const,
      },
    ])

    assert.equal(preview, "notes.pdf")
  })

  it("maps stored audio parts back into API shape", () => {
    const part = mapWorkspaceChatMessagePartRecord({
      attachmentId: "att_1",
      durationMs: 4200,
      fileName: null,
      mimeType: "audio/webm",
      partKind: "audio",
      textValue: "hello",
    })

    assert.deepEqual(part, {
      attachmentId: "att_1",
      durationMs: 4200,
      mimeType: "audio/webm",
      transcript: "hello",
      type: "audio",
    })
  })
})
