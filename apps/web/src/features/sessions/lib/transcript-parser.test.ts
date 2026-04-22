import { describe, expect, it } from "vitest"

import { parseTranscript } from "./transcript-parser"

describe("parseTranscript", () => {
  it("uses the OpenClaw audio transcript as the visible user text", () => {
    const transcriptJsonl = [
      JSON.stringify({
        id: "msg_audio",
        message: {
          content: [
            {
              text: `Conversation info (untrusted metadata):
\`\`\`json
{
  "message_id": "message_1",
  "sender_id": "user_1",
  "sender": "Michael Froehlich"
}
\`\`\`

[Audio]
User text:
[Workspace Chat Michael Froehlich Wed 2026-04-22 10:10 GMT+2] Voice note attached.
Transcript:
This is the voice note transcript.`,
              type: "text",
            },
          ],
          role: "user",
          timestamp: 1776845414633,
        },
        type: "message",
      }),
    ].join("\n")

    const messages = parseTranscript(transcriptJsonl)

    expect(messages[0]?.blocks).toEqual([
      {
        text: "This is the voice note transcript.",
        type: "text",
      },
    ])
  })
})
