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
  it("logs successful upstream stream completion with byte counts", async () => {
    const { entries, logger } = createLogger()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hello "))
        controller.enqueue(new TextEncoder().encode("world"))
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

    assert.equal(await new Response(wrapped).text(), "hello world")
    assert.deepEqual(
      entries.map((entry) => entry.message),
      [
        "[runtime-ai] openai proxy stream opened",
        "[runtime-ai] openai proxy upstream stream completed",
      ],
    )
    assert.equal(entries[1]?.fields.bytes, 11)
    assert.equal(entries[1]?.fields.chunks, 2)
    assert.equal(entries[1]?.fields.tenantId, "tenant_1")
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
      route: "responses",
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
