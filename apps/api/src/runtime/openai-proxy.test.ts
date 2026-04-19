import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createLoggedOpenAiProxyBody } from "./openai-proxy"

function createLogger() {
  const entries: Array<{
    level: "error" | "info" | "warn"
    message: string
    fields: Record<string, unknown>
  }> = []

  return {
    entries,
    logger: {
      error: (message: string, fields: Record<string, unknown>) => {
        entries.push({ fields, level: "error", message })
      },
      info: (message: string, fields: Record<string, unknown>) => {
        entries.push({ fields, level: "info", message })
      },
      warn: (message: string, fields: Record<string, unknown>) => {
        entries.push({ fields, level: "warn", message })
      },
    },
  }
}

describe("OpenAI runtime proxy stream logging", () => {
  it("logs successful upstream responses stream completion after response.completed", async () => {
    const { entries, logger } = createLogger()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              "event: response.created",
              'data: {"response":{"id":"resp_1"}}',
              "",
              "event: response.completed",
              'data: {"response":{"id":"resp_1"}}',
              "",
              "",
            ].join("\n"),
          ),
        )
        controller.close()
      },
    })

    const wrapped = createLoggedOpenAiProxyBody({
      body,
      logger,
      requestId: "req_1",
      route: "responses",
      tenantId: "tenant_1",
      upstreamRequestId: "upstream_1",
      upstreamStatus: 200,
    })

    assert.match(await new Response(wrapped).text(), /response.completed/)
    assert.deepEqual(
      entries.map((entry) => entry.message),
      [
        "[runtime-ai] openai proxy stream opened",
        "[runtime-ai] openai proxy responses stream completed",
      ],
    )
    assert.equal(entries[1]?.fields.terminalEventType, "response.completed")
    assert.equal(entries[1]?.fields.responseId, "resp_1")
    assert.equal(entries[1]?.fields.tenantId, "tenant_1")
  })

  it("fails a responses stream that reaches EOF before a terminal event", async () => {
    const { entries, logger } = createLogger()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              "event: response.created",
              'data: {"response":{"id":"resp_incomplete"}}',
              "",
              "event: response.output_text.delta",
              'data: {"delta":"partial"}',
              "",
              "",
            ].join("\n"),
          ),
        )
        controller.close()
      },
    })

    const wrapped = createLoggedOpenAiProxyBody({
      body,
      logger,
      requestId: "req_incomplete",
      route: "responses",
      tenantId: "tenant_1",
      upstreamRequestId: "upstream_incomplete",
      upstreamStatus: 200,
    })

    await assert.rejects(
      () => new Response(wrapped).text(),
      /OpenAI Responses stream ended before a terminal event/,
    )

    const incompleteLog = entries.find(
      (entry) =>
        entry.message === "[runtime-ai] openai proxy responses stream incomplete",
    )
    assert.equal(incompleteLog?.level, "error")
    assert.equal(incompleteLog?.fields.responseId, "resp_incomplete")
    assert.equal(incompleteLog?.fields.streamOutcome, "incomplete")
  })

  it("fails a responses stream that receives a response.failed terminal event", async () => {
    const { entries, logger } = createLogger()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              "event: response.failed",
              'data: {"response":{"id":"resp_failed"}}',
              "",
              "",
            ].join("\n"),
          ),
        )
        controller.close()
      },
    })

    const wrapped = createLoggedOpenAiProxyBody({
      body,
      logger,
      requestId: "req_failed",
      route: "responses",
      tenantId: "tenant_1",
      upstreamRequestId: "upstream_failed",
      upstreamStatus: 200,
    })

    await assert.rejects(
      () => new Response(wrapped).text(),
      /OpenAI Responses stream failed with terminal event response.failed/,
    )

    const failedLog = entries.find(
      (entry) => entry.message === "[runtime-ai] openai proxy responses stream failed",
    )
    assert.equal(failedLog?.level, "error")
    assert.equal(failedLog?.fields.terminalEventType, "response.failed")
    assert.equal(failedLog?.fields.streamOutcome, "failed")
  })

  it("logs downstream cancellation while cancelling the upstream reader", async () => {
    const { entries, logger } = createLogger()
    let upstreamCancelled = false
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        upstreamCancelled = true
      },
      start(controller) {
        controller.enqueue(new TextEncoder().encode("partial"))
      },
    })

    const wrapped = createLoggedOpenAiProxyBody({
      body,
      logger,
      requestId: "req_2",
      route: "audio_transcriptions",
      tenantId: "tenant_1",
      upstreamRequestId: null,
      upstreamStatus: 200,
    })

    const reader = wrapped.getReader()
    await reader.read()
    await reader.cancel("client closed")

    assert.equal(upstreamCancelled, true)
    const cancelLog = entries.find(
      (entry) => entry.message === "[runtime-ai] openai proxy downstream stream cancelled",
    )
    assert.equal(cancelLog?.level, "warn")
    assert.equal(cancelLog?.fields.reason, "client closed")
    assert.equal(cancelLog?.fields.bytes, 7)
  })

  it("logs upstream stream errors before rethrowing them to the downstream reader", async () => {
    const { entries, logger } = createLogger()
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("terminated")
      },
    })

    const wrapped = createLoggedOpenAiProxyBody({
      body,
      logger,
      requestId: "req_3",
      route: "responses",
      tenantId: "tenant_1",
      upstreamRequestId: "upstream_3",
      upstreamStatus: 200,
    })

    await assert.rejects(() => new Response(wrapped).text(), /terminated/)
    const errorLog = entries.find(
      (entry) => entry.message === "[runtime-ai] openai proxy upstream stream failed",
    )

    assert.equal(errorLog?.level, "error")
    assert.equal(errorLog?.fields.error, "terminated")
    assert.equal(errorLog?.fields.upstreamRequestId, "upstream_3")
  })
})
