import { describe, expect, it } from "vitest"

import { extractWorkspaceAudioTranscriptsFromSessionJsonl } from "./audio-transcripts"

describe("session audio transcript extraction", () => {
  it("extracts workspace chat message transcripts from OpenClaw audio turns", () => {
    const transcriptJsonl = [
      JSON.stringify({
        id: "msg_1",
        message: {
          content: [
            {
              text: `Conversation info (untrusted metadata):
\`\`\`json
{
  "chat_id": "workspace:conversation_1",
  "message_id": "205f0bf0-3489-4e3d-a508-93fd80341c88",
  "sender_id": "user_123"
}
\`\`\`

Sender (untrusted metadata):
\`\`\`json
{
  "id": "user_123",
  "name": "Michael Froehlich"
}
\`\`\`

[Audio]
User text:
[Workspace Chat Michael Froehlich Wed 2026-04-22 10:10 GMT+2] Ok cool, how does the story continue?
Transcript:
Like his friend or something? Would that be possible?`,
              type: "text",
            },
          ],
          role: "user",
          timestamp: 1776845414633,
        },
        type: "message",
      }),
    ].join("\n")

    expect(
      extractWorkspaceAudioTranscriptsFromSessionJsonl(transcriptJsonl),
    ).toEqual([
      {
        messageId: "205f0bf0-3489-4e3d-a508-93fd80341c88",
        messageTranscriptIndex: 0,
        transcript: "Like his friend or something? Would that be possible?",
      },
    ])
  })

  it("indexes multiple voice-note transcripts in one workspace message", () => {
    const baseEnvelope = `Conversation info (untrusted metadata):
\`\`\`json
{
  "chat_id": "workspace:conversation_1",
  "message_id": "message_1"
}
\`\`\`

[Audio]
User text:
[Workspace Chat Michael Froehlich Wed 2026-04-22 10:10 GMT+2] Voice note attached.
Transcript:`
    const transcriptJsonl = [
      JSON.stringify({
        message: {
          content: [
            { text: `${baseEnvelope}\nFirst voice note.`, type: "text" },
          ],
          role: "user",
        },
        type: "message",
      }),
      JSON.stringify({
        message: {
          content: [
            { text: `${baseEnvelope}\nSecond voice note.`, type: "text" },
          ],
          role: "user",
        },
        type: "message",
      }),
    ].join("\n")

    expect(
      extractWorkspaceAudioTranscriptsFromSessionJsonl(transcriptJsonl),
    ).toEqual([
      {
        messageId: "message_1",
        messageTranscriptIndex: 0,
        transcript: "First voice note.",
      },
      {
        messageId: "message_1",
        messageTranscriptIndex: 1,
        transcript: "Second voice note.",
      },
    ])
  })

  it("extracts repeated transcript sections from one OpenClaw user turn", () => {
    const transcriptJsonl = [
      JSON.stringify({
        message: {
          content: [
            {
              text: `Conversation info (untrusted metadata):
\`\`\`json
{
  "chat_id": "workspace:conversation_1",
  "message_id": "message_1"
}
\`\`\`

[Audio]
User text:
[Workspace Chat Michael Froehlich Wed 2026-04-22 10:10 GMT+2] Voice note attached.
Transcript:
First voice note.

[Audio]
User text:
[Workspace Chat Michael Froehlich Wed 2026-04-22 10:10 GMT+2] Voice note attached.
Transcript:
Second voice note.`,
              type: "text",
            },
          ],
          role: "user",
        },
        type: "message",
      }),
    ].join("\n")

    expect(
      extractWorkspaceAudioTranscriptsFromSessionJsonl(transcriptJsonl),
    ).toEqual([
      {
        messageId: "message_1",
        messageTranscriptIndex: 0,
        transcript: "First voice note.",
      },
      {
        messageId: "message_1",
        messageTranscriptIndex: 1,
        transcript: "Second voice note.",
      },
    ])
  })
})
