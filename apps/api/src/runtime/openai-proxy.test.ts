import assert from "node:assert/strict"

import { afterEach, describe, it, vi } from "vitest"

import {
  configureOpenAiProxyBunRequestTimeout,
  createLoggedOpenAiProxyBody,
  createOpenAiResponsesWebSocketBridge,
  prepareOpenAiAudioTranscriptionProxyRequest,
  summarizeOpenAiResponsesRequestBody,
} from "./openai-proxy"

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

class FakeWebSocket {
  closed: Array<{ code?: number; reason?: string }> = []
  listeners = new Map<string, Array<(event: Record<string, unknown>) => void>>()
  sent: unknown[] = []

  addEventListener(
    type: string,
    listener: (event: Record<string, unknown>) => void,
  ) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  close(code?: number, reason?: string) {
    this.closed.push({ code, reason })
  }

  emit(type: string, event: Record<string, unknown> = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  send(data: unknown) {
    this.sent.push(data)
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("OpenAI audio transcription proxy diagnostics", () => {
  it("repairs missing model values and reports safe multipart request metadata", async () => {
    const form = new FormData()
    form.append(
      "file",
      new Blob([Buffer.from("audio-bytes")], { type: "audio/x-m4a" }),
      "voice-note.m4a",
    )
    form.append("model", "undefined")

    const request = new Request(
      "https://getyourotto.com/api/internal/runtime/ai/openai/v1/audio/transcriptions",
      {
        body: form,
        headers: {
          Authorization: "Bearer tenant-token",
        },
        method: "POST",
      },
    )
    const incomingContentType = request.headers.get("content-type")
    const prepared = await prepareOpenAiAudioTranscriptionProxyRequest({
      bodyBuffer: Buffer.from(await request.arrayBuffer()),
      contentType: incomingContentType ?? "",
      headers: request.headers,
      incomingContentType,
    })

    assert.equal(prepared.contentType, null)
    assert.equal(prepared.modelRepaired, true)
    assert.equal(prepared.diagnostics.headers.authorization, "[redacted]")
    assert.equal(prepared.diagnostics.multipart?.model, "undefined")
    assert.equal(
      prepared.diagnostics.multipart?.resolvedModel,
      "gpt-4o-mini-transcribe",
    )
    assert.deepEqual(prepared.diagnostics.multipart?.fields, [
      {
        name: "model",
        sizeBytes: "undefined".length,
        value: "undefined",
      },
    ])
    assert.deepEqual(prepared.diagnostics.multipart?.files, [
      {
        contentType: "audio/x-m4a",
        fileName: "voice-note.m4a",
        name: "file",
        sizeBytes: "audio-bytes".length,
      },
    ])

    const rewritten = prepared.body as FormData
    assert.equal(rewritten.get("model"), "gpt-4o-mini-transcribe")
    const file = rewritten.get("file")
    assert.equal(file instanceof File, true)
    assert.equal((file as File).name, "voice-note.m4a")
    assert.equal(await (file as File).text(), "audio-bytes")
  })

  it("repairs chat model values before forwarding audio transcription requests", async () => {
    const form = new FormData()
    form.append(
      "file",
      new Blob([Buffer.from("audio-bytes")], { type: "audio/x-m4a" }),
      "voice-note.m4a",
    )
    form.append("model", "gpt-5.4")

    const request = new Request(
      "https://getyourotto.com/api/internal/runtime/ai/openai/v1/audio/transcriptions",
      {
        body: form,
        headers: {
          Authorization: "Bearer tenant-token",
        },
        method: "POST",
      },
    )
    const incomingContentType = request.headers.get("content-type")
    const prepared = await prepareOpenAiAudioTranscriptionProxyRequest({
      bodyBuffer: Buffer.from(await request.arrayBuffer()),
      contentType: incomingContentType ?? "",
      headers: request.headers,
      incomingContentType,
    })

    assert.equal(prepared.modelRepaired, true)
    assert.equal(prepared.diagnostics.multipart?.model, "gpt-5.4")
    assert.equal(
      prepared.diagnostics.multipart?.resolvedModel,
      "gpt-4o-mini-transcribe",
    )

    const rewritten = prepared.body as FormData
    assert.equal(rewritten.get("model"), "gpt-4o-mini-transcribe")
  })
})

describe("OpenAI runtime proxy stream logging", () => {
  it("logs Bun timeout policy for OpenAI proxy streaming requests", () => {
    const { entries, logger } = createLogger()
    const timeoutCalls: Array<{ request: Request; seconds: number }> = []
    const request = new Request(
      "https://getyourotto.com/api/internal/runtime/ai/openai/v1/responses",
    )

    const matched = configureOpenAiProxyBunRequestTimeout({
      idleTimeoutSeconds: 3,
      logger,
      request,
      server: {
        timeout: (timeoutRequest, seconds) => {
          timeoutCalls.push({ request: timeoutRequest, seconds })
        },
      },
    })

    assert.equal(matched, true)
    assert.equal(timeoutCalls.length, 1)
    assert.equal(timeoutCalls[0]?.request, request)
    assert.equal(timeoutCalls[0]?.seconds, 3)
    assert.equal(entries[0]?.message, "[api] openai proxy Bun timeout policy")
    assert.equal(
      entries[0]?.fields.path,
      "/api/internal/runtime/ai/openai/v1/responses",
    )
    assert.equal(entries[0]?.fields.bunDefaultIdleTimeoutSeconds, 10)
    assert.equal(entries[0]?.fields.idleTimeoutSeconds, 3)
    assert.equal(entries[0]?.fields.timeoutOverrideApplied, true)
  })

  it("logs Bun default timeout policy when no per-route override is configured", () => {
    const { entries, logger } = createLogger()
    const request = new Request(
      "https://getyourotto.com/api/internal/runtime/ai/openai/v1/responses",
    )

    const matched = configureOpenAiProxyBunRequestTimeout({
      logger,
      request,
      server: {
        timeout: () => {
          throw new Error("timeout override should not be applied")
        },
      },
    })

    assert.equal(matched, true)
    assert.equal(entries[0]?.fields.bunDefaultIdleTimeoutSeconds, 10)
    assert.equal(entries[0]?.fields.idleTimeoutSeconds, null)
    assert.equal(entries[0]?.fields.timeoutOverrideApplied, false)
  })

  it("ignores non-OpenAI-proxy requests for Bun timeout diagnostics", () => {
    const { entries, logger } = createLogger()
    const matched = configureOpenAiProxyBunRequestTimeout({
      idleTimeoutSeconds: 3,
      logger,
      request: new Request("https://getyourotto.com/api/workspace"),
      server: {
        timeout: () => {
          throw new Error("timeout override should not be applied")
        },
      },
    })

    assert.equal(matched, false)
    assert.equal(entries.length, 0)
  })

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
        entry.message ===
        "[runtime-ai] openai proxy responses stream incomplete",
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
      (entry) =>
        entry.message === "[runtime-ai] openai proxy responses stream failed",
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
      (entry) =>
        entry.message ===
        "[runtime-ai] openai proxy downstream stream cancelled",
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
      (entry) =>
        entry.message === "[runtime-ai] openai proxy upstream stream failed",
    )

    assert.equal(errorLog?.level, "error")
    assert.equal(errorLog?.fields.error, "terminated")
    assert.equal(errorLog?.fields.upstreamRequestId, "upstream_3")
  })

  it("logs request signal aborts with current responses observation", async () => {
    const { entries, logger } = createLogger()
    const abortController = new AbortController()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              "event: response.created",
              'data: {"response":{"id":"resp_abort"}}',
              "",
              "event: response.output_text.delta",
              'data: {"delta":"partial"}',
              "",
              "",
            ].join("\n"),
          ),
        )
      },
    })

    const wrapped = createLoggedOpenAiProxyBody({
      body,
      logger,
      requestId: "req_abort",
      requestSignal: abortController.signal,
      route: "responses",
      tenantId: "tenant_1",
      upstreamRequestId: "upstream_abort",
      upstreamStatus: 200,
    })

    const reader = wrapped.getReader()
    await reader.read()
    abortController.abort("tenant closed request")

    const abortLog = entries.find(
      (entry) =>
        entry.message === "[runtime-ai] openai proxy inbound request aborted",
    )
    assert.equal(abortLog?.level, "warn")
    assert.equal(abortLog?.fields.reason, "tenant closed request")
    assert.equal(abortLog?.fields.responseId, "resp_abort")
    assert.equal(abortLog?.fields.lastEventType, "response.output_text.delta")
    assert.equal(typeof abortLog?.fields.msSinceLastChunk, "number")
    assert.deepEqual(abortLog?.fields.recentEventTypes, [
      "response.created",
      "response.output_text.delta",
    ])

    await reader.cancel("test cleanup")
  })

  it("logs quiet stream diagnostics before the expected Bun idle timeout", async () => {
    vi.useFakeTimers()
    const { entries, logger } = createLogger()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              "event: response.created",
              'data: {"response":{"id":"resp_quiet"}}',
              "",
              "",
            ].join("\n"),
          ),
        )
      },
    })

    const wrapped = createLoggedOpenAiProxyBody({
      body,
      logger,
      quietWarningIntervalMs: 5,
      quietWarningMs: 10,
      requestId: "req_quiet",
      route: "responses",
      tenantId: "tenant_1",
      upstreamRequestId: "upstream_quiet",
      upstreamStatus: 200,
    })

    const reader = wrapped.getReader()
    await reader.read()
    await vi.advanceTimersByTimeAsync(15)

    const quietLog = entries.find(
      (entry) => entry.message === "[runtime-ai] openai proxy stream quiet",
    )
    assert.equal(quietLog?.level, "warn")
    assert.equal(quietLog?.fields.responseId, "resp_quiet")
    assert.equal(quietLog?.fields.streamOutcome, "quiet_before_terminal")
    assert.equal(quietLog?.fields.expectedBunIdleTimeoutSeconds, 10)
    assert.equal(typeof quietLog?.fields.msSinceLastChunk, "number")

    await reader.cancel("test cleanup")
  })

  it("tracks bounded responses event diagnostics without logging text", async () => {
    const { entries, logger } = createLogger()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              "event: response.created",
              'data: {"response":{"id":"resp_recent"}}',
              "",
              "event: response.output_text.delta",
              'data: {"delta":"secret text"}',
              "",
              "event: response.output_text.delta",
              'data: {"delta":"more secret text"}',
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
      requestId: "req_recent",
      route: "responses",
      tenantId: "tenant_1",
      upstreamRequestId: "upstream_recent",
      upstreamStatus: 200,
    })

    await assert.rejects(
      () => new Response(wrapped).text(),
      /OpenAI Responses stream ended before a terminal event/,
    )

    const incompleteLog = entries.find(
      (entry) =>
        entry.message ===
        "[runtime-ai] openai proxy responses stream incomplete",
    )
    assert.deepEqual(incompleteLog?.fields.recentEventTypes, [
      "response.created",
      "response.output_text.delta",
      "response.output_text.delta",
    ])
    assert.deepEqual(incompleteLog?.fields.eventTypeCounts, {
      "response.created": 1,
      "response.output_text.delta": 2,
    })
    assert.equal(
      JSON.stringify(incompleteLog?.fields).includes("secret text"),
      false,
    )
  })

  it("summarizes OpenAI Responses request bodies without prompt content", () => {
    const summary = summarizeOpenAiResponsesRequestBody(
      Buffer.from(
        JSON.stringify({
          input: [
            { role: "user", content: "do not log this" },
            {
              type: "function_call_output",
              call_id: "call_1",
              output: "hidden",
            },
          ],
          max_output_tokens: 1234,
          metadata: {
            openclaw_session_id: "session-1",
            secret: "hidden",
          },
          model: "gpt-5.4",
          previous_response_id: "resp_prev",
          reasoning: { effort: "high", summary: "auto" },
          stream: true,
          tool_choice: "auto",
          tools: [{ type: "function", name: "lookup_secret" }],
        }),
      ),
    )

    assert.deepEqual(summary, {
      inputItemCount: 2,
      maxOutputTokens: 1234,
      metadataKeys: ["openclaw_session_id", "secret"],
      model: "gpt-5.4",
      previousResponseIdPresent: true,
      reasoningEffort: "high",
      reasoningSummary: "auto",
      stream: true,
      toolChoiceType: "string",
      toolsCount: 1,
    })
    assert.equal(JSON.stringify(summary).includes("do not log this"), false)
    assert.equal(JSON.stringify(summary).includes("lookup_secret"), false)
  })
})

describe("OpenAI runtime proxy websocket bridge", () => {
  it("forwards websocket messages and logs response.completed terminal close", () => {
    const { entries, logger } = createLogger()
    const downstream = new FakeWebSocket()
    const upstream = new FakeWebSocket()

    const bridge = createOpenAiResponsesWebSocketBridge({
      apiKey: "sk-test",
      downstream,
      logger,
      openAiWebSocketFactory: (url, options) => {
        assert.equal(url, "wss://api.openai.com/v1/responses")
        assert.equal(options.headers.Authorization, "Bearer sk-test")
        assert.equal(options.headers["OpenAI-Beta"], "responses-websocket=v1")
        return upstream
      },
      openclawSessionId: "session_1",
      openclawTurnAttempt: "2",
      openclawTurnId: "turn_1",
      requestId: "ws_req_1",
      tenantId: "tenant_1",
    })

    upstream.emit("open")
    bridge.handleDownstreamMessage('{"type":"response.create"}')
    upstream.emit("message", {
      data: '{"type":"response.completed","response":{"id":"resp_ws_1"}}',
    })
    upstream.emit("close", { code: 1000, reason: "done" })

    assert.deepEqual(upstream.sent, ['{"type":"response.create"}'])
    assert.deepEqual(downstream.sent, [
      '{"type":"response.completed","response":{"id":"resp_ws_1"}}',
    ])
    assert.equal(
      entries.find(
        (entry) =>
          entry.message ===
          "[runtime-ai] openai proxy websocket stream completed",
      )?.fields.responseId,
      "resp_ws_1",
    )
  })

  it("logs upstream websocket close before terminal as incomplete", () => {
    const { entries, logger } = createLogger()
    const downstream = new FakeWebSocket()
    const upstream = new FakeWebSocket()
    createOpenAiResponsesWebSocketBridge({
      apiKey: "sk-test",
      downstream,
      logger,
      openAiWebSocketFactory: () => upstream,
      requestId: "ws_req_2",
      tenantId: "tenant_1",
    })

    upstream.emit("open")
    upstream.emit("message", {
      data: '{"type":"response.output_text.delta","delta":"partial"}',
    })
    upstream.emit("close", { code: 1006, reason: "abnormal" })

    assert.deepEqual(downstream.closed, [
      {
        code: 1011,
        reason: "OpenAI Responses websocket closed before terminal event.",
      },
    ])
    const incompleteLog = entries.find(
      (entry) =>
        entry.message ===
        "[runtime-ai] openai proxy websocket stream incomplete",
    )
    assert.equal(incompleteLog?.level, "error")
    assert.equal(incompleteLog?.fields.streamOutcome, "incomplete")
    assert.equal(incompleteLog?.fields.closeCode, 1006)
  })

  it("logs downstream websocket close before terminal and closes upstream", () => {
    const { entries, logger } = createLogger()
    const downstream = new FakeWebSocket()
    const upstream = new FakeWebSocket()
    const bridge = createOpenAiResponsesWebSocketBridge({
      apiKey: "sk-test",
      downstream,
      logger,
      openAiWebSocketFactory: () => upstream,
      requestId: "ws_req_3",
      tenantId: "tenant_1",
    })

    upstream.emit("open")
    bridge.handleDownstreamClose({ code: 1001, reason: "client closed" })

    assert.deepEqual(upstream.closed, [{ code: 1001, reason: "client closed" }])
    const cancelLog = entries.find(
      (entry) =>
        entry.message ===
        "[runtime-ai] openai proxy websocket downstream closed before terminal",
    )
    assert.equal(cancelLog?.level, "warn")
    assert.equal(
      cancelLog?.fields.streamOutcome,
      "downstream_cancelled_before_terminal",
    )
  })
})
