import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import {
  TranscriptViewer,
  type TranscriptViewerSession,
} from "./TranscriptViewer"

function buildSession(transcriptJsonl: string): TranscriptViewerSession {
  return {
    channel: "slack",
    channelProvider: "slack",
    chatType: "direct",
    displayName: "Direct message",
    endedAt: null,
    estimatedCostUsd: null,
    externalSessionId: "session_1",
    id: "session_1",
    inputTokens: null,
    label: null,
    lastSyncedAt: null,
    messageCount: 2,
    model: "gpt-5.4",
    modelProvider: "openai-proxy",
    originFrom: null,
    runtimeMs: null,
    sessionKey: "slack:direct:thread_1",
    startedAt: null,
    status: "done",
    subject: null,
    totalTokens: null,
    transcriptJsonl,
  }
}

describe("TranscriptViewer", () => {
  it("renders matching tool input and output in one exchange", () => {
    const transcriptJsonl = [
      JSON.stringify({
        id: "msg_tool_call",
        message: {
          content: [
            {
              id: "call_1",
              input: {
                command: "domain.availability.check",
                query: "example.com",
              },
              name: "execute_integration_command",
              type: "tool_use",
            },
          ],
          model: "gpt-5.4",
          role: "assistant",
          timestamp: 1776938760000,
        },
        type: "message",
      }),
      JSON.stringify({
        id: "msg_tool_result",
        message: {
          content: [
            {
              text: '{\n  "available": true\n}',
              type: "text",
            },
          ],
          role: "toolResult",
          timestamp: 1776938761000,
          toolCallId: "call_1",
          toolName: "execute_integration_command",
        },
        type: "message",
      }),
    ].join("\n")

    const markup = renderToStaticMarkup(
      <TranscriptViewer
        channelNames={{}}
        dateTimePreferences={{
          locale: "en-US",
          timeFormatPreference: "24",
          timeZone: "UTC",
        }}
        orgSlug="acme"
        session={buildSession(transcriptJsonl)}
      />,
    )

    const exchangeCount =
      markup.match(/data-tool-exchange-id="call_1"/g)?.length ?? 0
    const exchangeStart = markup.indexOf('data-tool-exchange-id="call_1"')
    const inputLabelIndex = markup.indexOf(">Input<", exchangeStart)
    const inputValueIndex = markup.indexOf("example.com", inputLabelIndex)
    const outputLabelIndex = markup.indexOf(">Output<", exchangeStart)
    const resultIndex = markup.indexOf(
      "&quot;available&quot;: true",
      exchangeStart,
    )

    assert.equal(exchangeCount, 1)
    assert.ok(inputLabelIndex < inputValueIndex)
    assert.ok(inputValueIndex < outputLabelIndex)
    assert.ok(outputLabelIndex < resultIndex)
  })
})
