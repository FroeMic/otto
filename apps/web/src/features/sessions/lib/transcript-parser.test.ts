import { describe, expect, it } from "vitest"

import { parseTranscript } from "./transcript-parser"

describe("parseTranscript", () => {
  it("renders OpenClaw toolResult messages as tool result blocks", () => {
    const transcriptJsonl = [
      JSON.stringify({
        id: "msg_tool_result",
        message: {
          content: [
            {
              text: '{\n  "ok": false,\n  "error": "Reconnect PostHog in your workspace."\n}',
              type: "text",
            },
          ],
          isError: true,
          role: "toolResult",
          timestamp: 1776938762824,
          toolCallId: "call_123",
          toolName: "execute_integration_command",
        },
        type: "message",
      }),
    ].join("\n")

    const messages = parseTranscript(transcriptJsonl)

    expect(messages).toEqual([
      {
        blocks: [
          {
            content:
              '{\n  "ok": false,\n  "error": "Reconnect PostHog in your workspace."\n}',
            isError: true,
            name: "execute_integration_command",
            toolCallId: "call_123",
            type: "tool_result",
          },
        ],
        id: "msg_tool_result",
        kind: "tool_result",
        model: null,
        senderId: null,
        senderName: null,
        timestamp: 1776938762824,
        usage: null,
      },
    ])
  })

  it("keeps the raw OpenClaw audio user text visible", () => {
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
        text: "Voice note attached.",
        type: "text",
      },
      {
        text: "This is the voice note transcript.",
        type: "audio_transcript",
      },
    ])
  })
})
