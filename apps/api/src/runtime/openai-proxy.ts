import { randomUUID } from "node:crypto"

import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  creditLedgerEntries,
  providerAccounts,
  providerCredentials,
} from "@otto/feature-integrations-runtime/db/schema"
import { decryptControlPlaneSecret } from "@otto/feature-integrations-runtime/lib/crypto"
import { and, desc, eq, isNull, sql } from "drizzle-orm"

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const OPENAI_AUDIO_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions"
const HOP_BY_HOP_HEADERS = new Set([
  "authorization",
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

type OpenAiProxyLogger = {
  error: (message: string, fields: Record<string, unknown>) => void
  info: (message: string, fields: Record<string, unknown>) => void
  warn: (message: string, fields: Record<string, unknown>) => void
}

const consoleOpenAiProxyLogger: OpenAiProxyLogger = {
  error: (message, fields) => console.error(message, fields),
  info: (message, fields) => console.info(message, fields),
  warn: (message, fields) => console.warn(message, fields),
}

export class OpenAiProxyError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = "OpenAiProxyError"
    this.status = status
  }
}

async function getTenantOpenAiApiKey(tenantId: string) {
  const db = getDb()
  const [credential] = await db
    .select({
      ciphertext: providerCredentials.ciphertext,
    })
    .from(providerCredentials)
    .innerJoin(
      providerAccounts,
      eq(providerCredentials.providerAccountId, providerAccounts.id),
    )
    .where(
      and(
        eq(providerAccounts.tenantId, tenantId),
        eq(providerAccounts.providerKey, "openai"),
        eq(providerCredentials.credentialType, "api_key"),
        isNull(providerCredentials.revokedAt),
        isNull(providerAccounts.revokedAt),
      ),
    )
    .orderBy(desc(providerCredentials.createdAt))
    .limit(1)

  return credential?.ciphertext
    ? decryptControlPlaneSecret(credential.ciphertext)
    : null
}

async function getTenantCreditBalanceMilli(tenantId: string) {
  const db = getDb()
  const [summary] = await db
    .select({
      currentBalanceCreditsMilli: sql`coalesce(sum(${creditLedgerEntries.creditsDeltaMilli}), 0)`,
    })
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.tenantId, tenantId))

  const value = summary?.currentBalanceCreditsMilli

  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function assertTenantCreditsAvailable(input: {
  balanceCreditsMilli: number
  tenantId: string
}) {
  if (input.balanceCreditsMilli > 0) {
    return
  }

  console.warn(
    `[runtime-ai] blocked tenant=${input.tenantId} due to exhausted balance balanceCreditsMilli=${input.balanceCreditsMilli}`,
  )
  throw new OpenAiProxyError(
    "You exceeded your current quota, please check your plan and billing details. Cause: You have run out of credits or hit your maximum monthly spend. Solution: Buy more credits or increase your limits.",
    429,
  )
}

function buildOpenAiRequestHeaders(input: {
  apiKey: string
  request: Request
}) {
  const headers = new Headers()

  for (const [name, value] of input.request.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue
    }

    headers.set(name, value)
  }

  headers.set("Authorization", `Bearer ${input.apiKey}`)
  return headers
}

function buildOpenAiResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers()

  for (const [name, value] of upstreamHeaders.entries()) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue
    }

    headers.set(name, value)
  }

  headers.set("Cache-Control", "no-store")
  return headers
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error
}

function formatCancelReason(reason: unknown) {
  if (reason === undefined) {
    return null
  }

  if (typeof reason === "string") {
    return reason
  }

  return getErrorMessage(reason)
}

function getOpenAiRequestId(headers: Headers) {
  return (
    headers.get("x-request-id") ??
    headers.get("request-id") ??
    headers.get("openai-request-id") ??
    null
  )
}

type ResponsesTerminalEvent = "error" | "response.completed" | "response.failed"

type ResponsesStreamObservation = {
  firstEventType: string | null
  lastEventType: string | null
  outputItemCount: number
  responseId: string | null
  sawTerminal: boolean
  terminalEventType: ResponsesTerminalEvent | null
}

function createResponsesStreamObservation(): ResponsesStreamObservation {
  return {
    firstEventType: null,
    lastEventType: null,
    outputItemCount: 0,
    responseId: null,
    sawTerminal: false,
    terminalEventType: null,
  }
}

function observeResponsesSseFrame(
  frame: string,
  observation: ResponsesStreamObservation,
) {
  let eventType: string | null = null
  const dataLines: string[] = []

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim()
      continue
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart())
    }
  }

  const data = dataLines.join("\n").trim()
  if (!eventType && data && data !== "[DONE]") {
    try {
      const parsed = JSON.parse(data) as { type?: unknown }
      eventType = typeof parsed.type === "string" ? parsed.type : null
    } catch {
      eventType = null
    }
  }

  if (!eventType) {
    return
  }

  observation.firstEventType ??= eventType
  observation.lastEventType = eventType

  if (eventType === "response.output_item.added") {
    observation.outputItemCount += 1
  }

  if (data && data !== "[DONE]") {
    try {
      const parsed = JSON.parse(data) as {
        response?: { id?: unknown }
        item?: { id?: unknown }
      }
      const responseId =
        typeof parsed.response?.id === "string" ? parsed.response.id : null
      if (responseId) {
        observation.responseId = responseId
      }
    } catch {
      // The observer should never break byte forwarding because a data frame
      // was not JSON or had an unexpected shape.
    }
  }

  if (
    eventType === "response.completed" ||
    eventType === "response.failed" ||
    eventType === "error"
  ) {
    observation.sawTerminal = true
    observation.terminalEventType = eventType
  }
}

function createResponsesSseObserver() {
  const decoder = new TextDecoder()
  const observation = createResponsesStreamObservation()
  let pending = ""

  const processPendingFrames = () => {
    let separatorIndex = pending.indexOf("\n\n")
    while (separatorIndex >= 0) {
      const frame = pending.slice(0, separatorIndex)
      pending = pending.slice(separatorIndex + 2)
      observeResponsesSseFrame(frame, observation)
      separatorIndex = pending.indexOf("\n\n")
    }
  }

  return {
    observation,
    observeChunk(chunk: Uint8Array) {
      pending += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n")
      processPendingFrames()
    },
    flush() {
      pending += decoder.decode().replace(/\r\n/g, "\n")
      if (pending.trim()) {
        observeResponsesSseFrame(pending, observation)
      }
      pending = ""
    },
  }
}

export function createLoggedOpenAiProxyBody(input: {
  body: ReadableStream<Uint8Array>
  logger?: OpenAiProxyLogger
  requestId: string
  route: "audio_transcriptions" | "responses"
  tenantId: string
  upstreamRequestId: string | null
  upstreamStatus: number
}) {
  const logger = input.logger ?? consoleOpenAiProxyLogger
  const reader = input.body.getReader()
  const startedAt = Date.now()
  let bytes = 0
  let chunks = 0
  let downstreamCancelled = false
  const responsesObserver =
    input.route === "responses" ? createResponsesSseObserver() : null

  const fields = () => ({
    bytes,
    chunks,
    durationMs: Date.now() - startedAt,
    firstEventType: responsesObserver?.observation.firstEventType ?? undefined,
    lastEventType: responsesObserver?.observation.lastEventType ?? undefined,
    outputItemCount: responsesObserver?.observation.outputItemCount ?? undefined,
    requestId: input.requestId,
    responseId: responsesObserver?.observation.responseId ?? undefined,
    route: input.route,
    tenantId: input.tenantId,
    terminalEventType:
      responsesObserver?.observation.terminalEventType ?? undefined,
    upstreamRequestId: input.upstreamRequestId,
    upstreamStatus: input.upstreamStatus,
  })

  return new ReadableStream<Uint8Array>({
    async cancel(reason) {
      downstreamCancelled = true
      if (responsesObserver && !responsesObserver.observation.sawTerminal) {
        logger.warn("[runtime-ai] openai proxy responses stream incomplete", {
          ...fields(),
          reason: formatCancelReason(reason),
          streamOutcome: "downstream_cancelled_before_terminal",
        })
      }
      logger.warn("[runtime-ai] openai proxy downstream stream cancelled", {
        ...fields(),
        reason: formatCancelReason(reason),
      })
      await reader.cancel(reason)
    },
    async pull(controller) {
      if (chunks === 0 && bytes === 0) {
        logger.info("[runtime-ai] openai proxy stream opened", fields())
      }

      try {
        const result = await reader.read()

        if (result.done) {
          responsesObserver?.flush()

          if (responsesObserver) {
            const terminalEventType =
              responsesObserver.observation.terminalEventType
            if (terminalEventType === "response.completed") {
              logger.info(
                "[runtime-ai] openai proxy responses stream completed",
                {
                  ...fields(),
                  streamOutcome: "completed",
                },
              )
              controller.close()
              return
            }

            if (
              terminalEventType === "response.failed" ||
              terminalEventType === "error"
            ) {
              const error = new Error(
                `OpenAI Responses stream failed with terminal event ${terminalEventType}.`,
              )
              logger.error("[runtime-ai] openai proxy responses stream failed", {
                ...fields(),
                error: error.message,
                errorName: error.name,
                streamOutcome: "failed",
              })
              controller.error(error)
              return
            }

            const error = new Error(
              "OpenAI Responses stream ended before a terminal event.",
            )
            logger.error("[runtime-ai] openai proxy responses stream incomplete", {
              ...fields(),
              error: error.message,
              errorName: error.name,
              streamOutcome: downstreamCancelled
                ? "downstream_cancelled_before_terminal"
                : "incomplete",
            })
            controller.error(error)
            return
          }

          logger.info("[runtime-ai] openai proxy upstream stream completed", fields())
          controller.close()
          return
        }

        const chunkBytes = result.value.byteLength
        bytes += chunkBytes
        chunks += 1
        responsesObserver?.observeChunk(result.value)
        controller.enqueue(result.value)
      } catch (error) {
        if (responsesObserver && responsesObserver.observation.sawTerminal) {
          logger.warn(
            "[runtime-ai] openai proxy upstream stream closed after terminal event",
            {
              ...fields(),
              error: getErrorMessage(error),
              errorName: getErrorName(error),
            },
          )
          controller.close()
          return
        }

        logger.error("[runtime-ai] openai proxy upstream stream failed", {
          ...fields(),
          error: getErrorMessage(error),
          errorName: getErrorName(error),
        })
        controller.error(error)
      }
    },
  })
}

async function proxyOpenAiRequest(input: {
  request: Request
  tenantId: string
  upstreamUrl: string
  route: "responses"
}) {
  const requestId = randomUUID()
  const startedAt = Date.now()
  const [apiKey, balanceCreditsMilli] = await Promise.all([
    getTenantOpenAiApiKey(input.tenantId),
    getTenantCreditBalanceMilli(input.tenantId),
  ])

  assertTenantCreditsAvailable({
    balanceCreditsMilli,
    tenantId: input.tenantId,
  })

  if (!apiKey) {
    throw new OpenAiProxyError(
      "This workspace does not have an active OpenAI API key configured.",
      503,
    )
  }

  const bodyBuffer = Buffer.from(await input.request.arrayBuffer())
  let upstreamResponse: Response

  console.info("[runtime-ai] openai proxy request starting", {
    bodyBytes: bodyBuffer.byteLength,
    requestId,
    route: input.route,
    tenantId: input.tenantId,
  })

  try {
    upstreamResponse = await fetch(input.upstreamUrl, {
      body: bodyBuffer,
      headers: buildOpenAiRequestHeaders({
        apiKey,
        request: input.request,
      }),
      method: "POST",
    })
  } catch (error) {
    console.error("[runtime-ai] openai proxy upstream request failed", {
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
      errorName: getErrorName(error),
      requestId,
      route: input.route,
      tenantId: input.tenantId,
    })
    throw new OpenAiProxyError(
      error instanceof Error
        ? `OpenAI upstream request failed: ${error.message}`
        : "OpenAI upstream request failed.",
      502,
    )
  }

  const upstreamRequestId = getOpenAiRequestId(upstreamResponse.headers)

  console.info("[runtime-ai] openai proxy upstream response received", {
    contentType: upstreamResponse.headers.get("content-type"),
    durationMs: Date.now() - startedAt,
    requestId,
    route: input.route,
    tenantId: input.tenantId,
    upstreamRequestId,
    upstreamStatus: upstreamResponse.status,
  })

  if (!upstreamResponse.body) {
    console.warn("[runtime-ai] openai proxy upstream response had no body", {
      durationMs: Date.now() - startedAt,
      requestId,
      route: input.route,
      tenantId: input.tenantId,
      upstreamRequestId,
      upstreamStatus: upstreamResponse.status,
    })
  }

  const responseBody = upstreamResponse.body
    ? createLoggedOpenAiProxyBody({
        body: upstreamResponse.body,
        requestId,
        route: input.route,
        tenantId: input.tenantId,
        upstreamRequestId,
        upstreamStatus: upstreamResponse.status,
      })
    : null

  return new Response(responseBody, {
    headers: buildOpenAiResponseHeaders(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  })
}

export function proxyOpenAiResponsesRequest(input: {
  request: Request
  tenantId: string
}) {
  return proxyOpenAiRequest({
    request: input.request,
    route: "responses",
    tenantId: input.tenantId,
    upstreamUrl: OPENAI_RESPONSES_URL,
  })
}

export async function proxyOpenAiAudioTranscriptionsRequest(input: {
  request: Request
  tenantId: string
}) {
  const [apiKey, balanceCreditsMilli] = await Promise.all([
    getTenantOpenAiApiKey(input.tenantId),
    getTenantCreditBalanceMilli(input.tenantId),
  ])

  assertTenantCreditsAvailable({
    balanceCreditsMilli,
    tenantId: input.tenantId,
  })

  if (!apiKey) {
    throw new OpenAiProxyError(
      "This workspace does not have an active OpenAI API key configured.",
      503,
    )
  }

  // The OpenClaw runtime sends multipart/form-data bodies but an upstream
  // fetch quirk can set the Content-Type header to text/plain instead of
  // multipart/form-data. The raw body IS correctly multipart-encoded — only
  // the header is wrong. Detect the boundary from the body and reconstruct
  // the correct Content-Type before forwarding to OpenAI.
  const bodyBuffer = Buffer.from(await input.request.arrayBuffer())
  const incomingContentType = input.request.headers.get("content-type")
  let contentType = incomingContentType ?? ""

  if (!contentType.startsWith("multipart/form-data")) {
    const firstLine = bodyBuffer.subarray(0, 200).toString("utf-8").split("\r\n")[0]
    if (firstLine.startsWith("--")) {
      const boundary = firstLine.slice(2)
      contentType = `multipart/form-data; boundary=${boundary}`
    } else {
      console.error("[audio-proxy] unexpected body encoding", {
        contentType: incomingContentType,
      })
    }
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(OPENAI_AUDIO_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": contentType,
      },
      body: bodyBuffer,
    })
  } catch (error) {
    throw new OpenAiProxyError(
      error instanceof Error
        ? `OpenAI upstream request failed: ${error.message}`
        : "OpenAI upstream request failed.",
      502,
    )
  }

  if (!upstreamResponse.ok) {
    console.error("[audio-proxy] upstream error", {
      status: upstreamResponse.status,
    })
  }

  return new Response(upstreamResponse.body, {
    headers: buildOpenAiResponseHeaders(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  })
}
