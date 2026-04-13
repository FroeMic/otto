import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { buildWorkspaceChatComposerParts } from "./composer-parts"

describe("workspace chat composer parts", () => {
  it("builds mixed text, file, and audio message parts", () => {
    const parts = buildWorkspaceChatComposerParts({
      attachments: [
        {
          attachment: {
            fileName: "notes.txt",
            id: "att_file_1",
            mimeType: "text/plain",
            sizeBytes: 12,
          },
          kind: "file",
        },
        {
          attachment: {
            fileName: "voice-note.webm",
            id: "att_audio_1",
            mimeType: "audio/webm",
            sizeBytes: 128,
          },
          durationMs: 12_345,
          kind: "audio",
        },
      ],
      text: "Please review both attachments.",
    })

    assert.deepEqual(parts, [
      {
        text: "Please review both attachments.",
        type: "text",
      },
      {
        attachmentId: "att_file_1",
        fileName: "notes.txt",
        mimeType: "text/plain",
        type: "file",
      },
      {
        attachmentId: "att_audio_1",
        durationMs: 12_345,
        mimeType: "audio/webm",
        type: "audio",
      },
    ])
  })

  it("omits empty text and preserves audio-only sends", () => {
    const parts = buildWorkspaceChatComposerParts({
      attachments: [
        {
          attachment: {
            fileName: "voice-note.webm",
            id: "att_audio_1",
            mimeType: "audio/webm",
            sizeBytes: 128,
          },
          kind: "audio",
        },
      ],
      text: "   ",
    })

    assert.deepEqual(parts, [
      {
        attachmentId: "att_audio_1",
        mimeType: "audio/webm",
        type: "audio",
      },
    ])
  })

  it("normalizes browser voice notes that arrive as video webm", () => {
    const parts = buildWorkspaceChatComposerParts({
      attachments: [
        {
          attachment: {
            fileName: "voice-note.webm",
            id: "att_audio_1",
            mimeType: "video/webm;codecs=opus",
            sizeBytes: 128,
          },
          kind: "audio",
        },
      ],
      text: "  ",
    })

    assert.deepEqual(parts, [
      {
        attachmentId: "att_audio_1",
        mimeType: "audio/webm;codecs=opus",
        type: "audio",
      },
    ])
  })
})
