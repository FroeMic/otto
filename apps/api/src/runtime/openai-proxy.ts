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
const OPENAI_RESPONSES_WS_URL = "wss://api.openai.com/v1/responses"
const OPENAI_AUDIO_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions"
const DEFAULT_OPENAI_AUDIO_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
const OPENAI_PROXY_STREAM_PATH_PREFIX = "/api/internal/runtime/ai/openai/v1/"
const BUN_DEFAULT_IDLE_TIMEOUT_SECONDS = 10
const OPENAI_PROXY_QUIET_WARNING_MS = 8_000
const OPENAI_PROXY_QUIET_WARNING_INTERVAL_MS = 1_000
const AUDIO_PROXY_ERROR_BODY_LOG_LIMIT = 4_000
const REDACTED_HEADER_VALUE = "[redacted]"
const OPENAI_AUDIO_TRANSCRIPTION_MODELS = new Set([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
])
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
const SENSITIVE_LOG_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
])

type OpenAiProxyLogger = {
  error: (message: string, fields: Record<string, unknown>) => void
  info: (message: string, fields: Record<string, unknown>) => void
  warn: (message: string, fields: Record<string, unknown>) => void
}

type BunRequestTimeoutServer = {
  timeout: (request: Request, seconds: number) => void
}

const consoleOpenAiProxyLogger: OpenAiProxyLogger = {
  error: (message, fields) => console.error(message, fields),
  info: (message, fields) => console.info(message, fields),
  warn: (message, fields) => console.warn(message, fields),
}

function getRequestPathname(request: Request) {
  try {
    return new URL(request.url).pathname
  } catch {
    return null
  }
}

function truncateForLog(value: string, maxLength = AUDIO_PROXY_ERROR_BODY_LOG_LIMIT) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function bufferToBodyInit(buffer: Buffer): Blob {
  return new Blob([new Uint8Array(buffer)])
}

function describeUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function redactHeadersForLog(headers: Headers) {
  const result: Record<string, string> = {}
  for (const [name, value] of headers.entries()) {
    result[name] = SENSITIVE_LOG_HEADERS.has(name.toLowerCase())
      ? REDACTED_HEADER_VALUE
      : value
  }
  return result
}

export function resolveOpenAiAudioTranscriptionModel(
  value: unknown,
  fallback = DEFAULT_OPENAI_AUDIO_TRANSCRIPTION_MODEL,
) {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }

  const normalized = trimmed.toLowerCase()
  return OPENAI_AUDIO_TRANSCRIPTION_MODELS.has(normalized)
    ? normalized
    : fallback
}

type AudioProxyMultipartFieldLog = {
  name: string
  sizeBytes: number
  value?: string
}

type AudioProxyMultipartFileLog = {
  contentType: string | null
  fileName: string
  name: string
  sizeBytes: number
}

type AudioProxyMultipartLog = {
  fields: AudioProxyMultipartFieldLog[]
  files: AudioProxyMultipartFileLog[]
  model: string | null
  modelRepaired: boolean
  resolvedModel: string
}

type AudioProxyRequestDiagnostics = {
  bodyBytes: number
  contentType: string | null
  headers: Record<string, string>
  incomingContentType: string | null
  multipart?: AudioProxyMultipartLog
  multipartParseError?: string
}

type PreparedOpenAiAudioTranscriptionProxyRequest = {
  body: Blob | FormData
  contentType: string | null
  diagnostics: AudioProxyRequestDiagnostics
  modelRepaired: boolean
}

function shouldLogFormFieldValue(name: string) {
  const normalized = name.trim().toLowerCase()
  return normalized === "model" || normalized === "language"
}

function summarizeAudioTranscriptionFormData(
  formData: FormData,
): Omit<AudioProxyMultipartLog, "modelRepaired" | "resolvedModel"> {
  const fields: AudioProxyMultipartFieldLog[] = []
  const files: AudioProxyMultipartFileLog[] = []
  let model: string | null = null

  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") {
      if (name === "model") {
        model = value
      }
      fields.push({
        name,
        sizeBytes: Buffer.byteLength(value),
        ...(shouldLogFormFieldValue(name)
          ? { value: truncateForLog(value, 500) }
          : {}),
      })
      continue
    }

    files.push({
      contentType: value.type || null,
      fileName: value.name,
      name,
      sizeBytes: value.size,
    })
  }

  return { fields, files, model }
}

async function parseAudioTranscriptionFormData(input: {
  bodyBuffer: Buffer
  contentType: string
}) {
  if (!input.contentType.startsWith("multipart/form-data")) {
    return null
  }

  const request = new Request("http://audio-proxy.local/transcriptions", {
    body: bufferToBodyInit(input.bodyBuffer),
    headers: {
      "Content-Type": input.contentType,
    },
    method: "POST",
  })

  return request.formData()
}

export async function prepareOpenAiAudioTranscriptionProxyRequest(input: {
  bodyBuffer: Buffer
  contentType: string
  headers: Headers
  incomingContentType: string | null
}): Promise<PreparedOpenAiAudioTranscriptionProxyRequest> {
  const diagnostics: AudioProxyRequestDiagnostics = {
    bodyBytes: input.bodyBuffer.byteLength,
    contentType: input.contentType || null,
    headers: redactHeadersForLog(input.headers),
    incomingContentType: input.incomingContentType,
  }

  let formData: FormData | null = null
  try {
    formData = await parseAudioTranscriptionFormData({
      bodyBuffer: input.bodyBuffer,
      contentType: input.contentType,
    })
  } catch (error) {
    diagnostics.multipartParseError = describeUnknownError(error)
  }

  if (!formData) {
    return {
      body: bufferToBodyInit(input.bodyBuffer),
      contentType: input.contentType || null,
      diagnostics,
      modelRepaired: false,
    }
  }

  const multipart = summarizeAudioTranscriptionFormData(formData)
  const resolvedModel = resolveOpenAiAudioTranscriptionModel(multipart.model)
  const modelRepaired = multipart.model !== resolvedModel

  diagnostics.multipart = {
    ...multipart,
    modelRepaired,
    resolvedModel,
  }

  if (!modelRepaired) {
    return {
      body: bufferToBodyInit(input.bodyBuffer),
      contentType: input.contentType || null,
      diagnostics,
      modelRepaired,
    }
  }

  formData.set("model", resolvedModel)

  return {
    body: formData,
    contentType: null,
    diagnostics,
    modelRepaired,
  }
}

export function configureOpenAiProxyBunRequestTimeout(input: {
  idleTimeoutSeconds?: number
  logger?: OpenAiProxyLogger
  request: Request
  server?: BunRequestTimeoutServer
}) {
  const pathname = getRequestPathname(input.request)
  if (!pathname?.startsWith(OPENAI_PROXY_STREAM_PATH_PREFIX)) {
    return false
  }

  const logger = input.logger ?? consoleOpenAiProxyLogger
  const timeoutOverrideApplied = input.idleTimeoutSeconds !== undefined

  if (timeoutOverrideApplied) {
    input.server?.timeout(input.request, input.idleTimeoutSeconds ?? 0)
  }

  logger.info("[api] openai proxy Bun timeout policy", {
    bunDefaultIdleTimeoutSeconds: BUN_DEFAULT_IDLE_TIMEOUT_SECONDS,
    idleTimeoutSeconds: input.idleTimeoutSeconds ?? null,
    path: pathname,
    timeoutOverrideApplied,
  })

  return true
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

function getCorrelationValue(headers: Headers, name: string) {
  const value = headers.get(name)?.trim()
  return value ? value : null
}

export function summarizeOpenAiResponsesRequestBody(body: Buffer) {
  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(body.toString("utf8")) as Record<string, unknown>
  } catch {
    return {
      parseError: "invalid_json",
    }
  }

  const metadata =
    parsed.metadata && typeof parsed.metadata === "object"
      ? (parsed.metadata as Record<string, unknown>)
      : null
  const reasoning =
    parsed.reasoning && typeof parsed.reasoning === "object"
      ? (parsed.reasoning as Record<string, unknown>)
      : null

  return {
    inputItemCount: Array.isArray(parsed.input)
      ? parsed.input.length
      : undefined,
    maxOutputTokens:
      typeof parsed.max_output_tokens === "number"
        ? parsed.max_output_tokens
        : undefined,
    metadataKeys: metadata ? Object.keys(metadata).sort() : undefined,
    model: typeof parsed.model === "string" ? parsed.model : undefined,
    previousResponseIdPresent:
      typeof parsed.previous_response_id === "string" &&
      parsed.previous_response_id.trim().length > 0,
    reasoningEffort:
      typeof reasoning?.effort === "string" ? reasoning.effort : undefined,
    reasoningSummary:
      typeof reasoning?.summary === "string" ? reasoning.summary : undefined,
    stream: typeof parsed.stream === "boolean" ? parsed.stream : undefined,
    toolChoiceType:
      parsed.tool_choice === undefined
        ? undefined
        : Array.isArray(parsed.tool_choice)
          ? "array"
          : typeof parsed.tool_choice,
    toolsCount: Array.isArray(parsed.tools) ? parsed.tools.length : undefined,
  }
}

type ResponsesTerminalEvent = "error" | "response.completed" | "response.failed"

type ResponsesStreamObservation = {
  eventTypeCounts: Record<string, number>
  firstEventType: string | null
  lastEventAtMs: number | null
  lastEventType: string | null
  outputItemCount: number
  recentEventTypes: string[]
  responseId: string | null
  sawTerminal: boolean
  terminalEventType: ResponsesTerminalEvent | null
}

const MAX_RECENT_RESPONSE_EVENT_TYPES = 20

function createResponsesStreamObservation(): ResponsesStreamObservation {
  return {
    eventTypeCounts: {},
    firstEventType: null,
    lastEventAtMs: null,
    lastEventType: null,
    outputItemCount: 0,
    recentEventTypes: [],
    responseId: null,
    sawTerminal: false,
    terminalEventType: null,
  }
}

function recordResponsesEventType(
  eventType: string,
  observation: ResponsesStreamObservation,
) {
  observation.firstEventType ??= eventType
  observation.lastEventType = eventType
  observation.lastEventAtMs = Date.now()
  observation.eventTypeCounts[eventType] =
    (observation.eventTypeCounts[eventType] ?? 0) + 1
  observation.recentEventTypes.push(eventType)
  if (observation.recentEventTypes.length > MAX_RECENT_RESPONSE_EVENT_TYPES) {
    observation.recentEventTypes.shift()
  }

  if (eventType === "response.output_item.added") {
    observation.outputItemCount += 1
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

  recordResponsesEventType(eventType, observation)

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
}

function observeResponsesEventData(
  data: unknown,
  observation: ResponsesStreamObservation,
) {
  const text =
    typeof data === "string"
      ? data
      : data instanceof ArrayBuffer
        ? Buffer.from(data).toString("utf8")
        : ArrayBuffer.isView(data)
          ? Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
              "utf8",
            )
          : String(data)

  if (!text.trim()) {
    return
  }

  let parsed: {
    response?: { id?: unknown }
    type?: unknown
  }

  try {
    parsed = JSON.parse(text)
  } catch {
    return
  }

  const eventType = typeof parsed.type === "string" ? parsed.type : null
  if (!eventType) {
    return
  }

  recordResponsesEventType(eventType, observation)

  const responseId =
    typeof parsed.response?.id === "string" ? parsed.response.id : null
  if (responseId) {
    observation.responseId = responseId
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
  quietWarningIntervalMs?: number
  quietWarningMs?: number
  requestSignal?: AbortSignal
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
  let lastChunkAtMs: number | null = null
  let quietWarningLogged = false
  let quietInterval: ReturnType<typeof setInterval> | undefined
  const responsesObserver =
    input.route === "responses" ? createResponsesSseObserver() : null
  const quietWarningMs = input.quietWarningMs ?? OPENAI_PROXY_QUIET_WARNING_MS
  const quietWarningIntervalMs =
    input.quietWarningIntervalMs ?? OPENAI_PROXY_QUIET_WARNING_INTERVAL_MS

  const msSinceLastChunk = () => Date.now() - (lastChunkAtMs ?? startedAt)

  const fields = () => ({
    bytes,
    chunks,
    durationMs: Date.now() - startedAt,
    eventTypeCounts:
      responsesObserver?.observation.eventTypeCounts &&
      Object.keys(responsesObserver.observation.eventTypeCounts).length > 0
        ? { ...responsesObserver.observation.eventTypeCounts }
        : undefined,
    firstEventType: responsesObserver?.observation.firstEventType ?? undefined,
    lastEventType: responsesObserver?.observation.lastEventType ?? undefined,
    msSinceLastEvent:
      responsesObserver?.observation.lastEventAtMs == null
        ? undefined
        : Date.now() - responsesObserver.observation.lastEventAtMs,
    msSinceLastChunk: msSinceLastChunk(),
    outputItemCount:
      responsesObserver?.observation.outputItemCount ?? undefined,
    recentEventTypes:
      responsesObserver &&
      responsesObserver.observation.recentEventTypes.length > 0
        ? [...responsesObserver.observation.recentEventTypes]
        : undefined,
    requestId: input.requestId,
    requestSignalAborted: input.requestSignal?.aborted ?? false,
    responseId: responsesObserver?.observation.responseId ?? undefined,
    route: input.route,
    tenantId: input.tenantId,
    terminalEventType:
      responsesObserver?.observation.terminalEventType ?? undefined,
    upstreamRequestId: input.upstreamRequestId,
    upstreamStatus: input.upstreamStatus,
  })

  const requestAbortListener = () => {
    logger.warn("[runtime-ai] openai proxy inbound request aborted", {
      ...fields(),
      reason: formatCancelReason(input.requestSignal?.reason),
      streamOutcome:
        responsesObserver && !responsesObserver.observation.sawTerminal
          ? "downstream_cancelled_before_terminal"
          : undefined,
    })
  }

  if (input.requestSignal) {
    if (input.requestSignal.aborted) {
      requestAbortListener()
    } else {
      input.requestSignal.addEventListener("abort", requestAbortListener, {
        once: true,
      })
    }
  }

  const cleanup = () => {
    if (quietInterval) {
      clearInterval(quietInterval)
      quietInterval = undefined
    }
    input.requestSignal?.removeEventListener("abort", requestAbortListener)
  }

  return new ReadableStream<Uint8Array>({
    start() {
      if (input.route !== "responses" || quietWarningMs <= 0) {
        return
      }

      quietInterval = setInterval(() => {
        if (quietWarningLogged) {
          return
        }

        const quietMs = msSinceLastChunk()
        if (quietMs < quietWarningMs) {
          return
        }

        quietWarningLogged = true
        logger.warn("[runtime-ai] openai proxy stream quiet", {
          ...fields(),
          expectedBunIdleTimeoutSeconds: BUN_DEFAULT_IDLE_TIMEOUT_SECONDS,
          quietMs,
          streamOutcome:
            responsesObserver && !responsesObserver.observation.sawTerminal
              ? "quiet_before_terminal"
              : undefined,
        })
      }, quietWarningIntervalMs)
      quietInterval.unref?.()
    },
    async cancel(reason) {
      cleanup()
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
          cleanup()
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
              logger.error(
                "[runtime-ai] openai proxy responses stream failed",
                {
                  ...fields(),
                  error: error.message,
                  errorName: error.name,
                  streamOutcome: "failed",
                },
              )
              controller.error(error)
              return
            }

            const error = new Error(
              "OpenAI Responses stream ended before a terminal event.",
            )
            logger.error(
              "[runtime-ai] openai proxy responses stream incomplete",
              {
                ...fields(),
                error: error.message,
                errorName: error.name,
                streamOutcome: downstreamCancelled
                  ? "downstream_cancelled_before_terminal"
                  : "incomplete",
              },
            )
            controller.error(error)
            return
          }

          logger.info(
            "[runtime-ai] openai proxy upstream stream completed",
            fields(),
          )
          controller.close()
          return
        }

        const chunkBytes = result.value.byteLength
        bytes += chunkBytes
        chunks += 1
        lastChunkAtMs = Date.now()
        quietWarningLogged = false
        responsesObserver?.observeChunk(result.value)
        controller.enqueue(result.value)
      } catch (error) {
        if (responsesObserver?.observation.sawTerminal) {
          cleanup()
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

        cleanup()
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

type UpstreamProxyWebSocketLike = {
  addEventListener: (
    type: "close" | "error" | "message" | "open",
    listener: (event: Record<string, unknown>) => void,
  ) => void
  close: (code?: number, reason?: string) => void
  send: (data: unknown) => void
}

type DownstreamProxyWebSocketLike = {
  close: (code?: number, reason?: string) => void
  send: (data: unknown) => void
}

type OpenAiResponsesWebSocketFactory = (
  url: string,
  options: { headers: Record<string, string> },
) => UpstreamProxyWebSocketLike

function buildOpenAiWebSocketHeaders(input: { apiKey: string }) {
  return {
    Authorization: `Bearer ${input.apiKey}`,
    "OpenAI-Beta": "responses-websocket=v1",
  }
}

function defaultOpenAiResponsesWebSocketFactory(
  url: string,
  options: { headers: Record<string, string> },
) {
  const WebSocketCtor = globalThis.WebSocket as unknown as
    | (new (
        url: string,
        protocolsOrOptions?: { headers?: Record<string, string> },
      ) => UpstreamProxyWebSocketLike)
    | undefined

  if (!WebSocketCtor) {
    throw new OpenAiProxyError(
      "This runtime does not provide a WebSocket client implementation.",
      500,
    )
  }

  return new WebSocketCtor(url, { headers: options.headers })
}

function getWebSocketCloseCode(event: Record<string, unknown>) {
  return typeof event.code === "number" ? event.code : undefined
}

function getWebSocketCloseReason(event: Record<string, unknown>) {
  if (typeof event.reason === "string") {
    return event.reason
  }

  if (event.reason == null) {
    return undefined
  }

  return String(event.reason)
}

export function createOpenAiResponsesWebSocketBridge(input: {
  apiKey: string
  downstream: DownstreamProxyWebSocketLike
  logger?: OpenAiProxyLogger
  openAiWebSocketFactory?: OpenAiResponsesWebSocketFactory
  openclawSessionId?: string | null
  openclawTurnAttempt?: string | null
  openclawTurnId?: string | null
  requestId: string
  tenantId: string
}) {
  const logger = input.logger ?? consoleOpenAiProxyLogger
  const startedAt = Date.now()
  const observation = createResponsesStreamObservation()
  let bytes = 0
  let chunks = 0
  let upstreamOpen = false
  let upstreamClosed = false
  let downstreamClosed = false
  const queuedDownstreamMessages: unknown[] = []

  const fields = () => ({
    bytes,
    chunks,
    durationMs: Date.now() - startedAt,
    firstEventType: observation.firstEventType ?? undefined,
    lastEventType: observation.lastEventType ?? undefined,
    openclawSessionId: input.openclawSessionId ?? undefined,
    openclawTurnAttempt: input.openclawTurnAttempt ?? undefined,
    openclawTurnId: input.openclawTurnId ?? undefined,
    outputItemCount: observation.outputItemCount,
    requestId: input.requestId,
    responseId: observation.responseId ?? undefined,
    route: "responses",
    tenantId: input.tenantId,
    terminalEventType: observation.terminalEventType ?? undefined,
    transport: "websocket",
  })

  const upstream = (
    input.openAiWebSocketFactory ?? defaultOpenAiResponsesWebSocketFactory
  )(OPENAI_RESPONSES_WS_URL, {
    headers: buildOpenAiWebSocketHeaders({ apiKey: input.apiKey }),
  })

  logger.info("[runtime-ai] openai proxy websocket request starting", fields())

  upstream.addEventListener("open", () => {
    upstreamOpen = true
    logger.info("[runtime-ai] openai proxy websocket stream opened", fields())

    while (queuedDownstreamMessages.length > 0) {
      upstream.send(queuedDownstreamMessages.shift())
    }
  })

  upstream.addEventListener("message", (event) => {
    const data = event.data
    if (data != null) {
      const chunkBytes =
        typeof data === "string"
          ? Buffer.byteLength(data)
          : data instanceof ArrayBuffer
            ? data.byteLength
            : ArrayBuffer.isView(data)
              ? data.byteLength
              : Buffer.byteLength(String(data))
      bytes += chunkBytes
      chunks += 1
      observeResponsesEventData(data, observation)
      input.downstream.send(data)
    }
  })

  upstream.addEventListener("error", (event) => {
    if (observation.sawTerminal) {
      logger.warn(
        "[runtime-ai] openai proxy websocket upstream error after terminal event",
        {
          ...fields(),
          error: getErrorMessage(event.error),
          errorName: getErrorName(event.error),
        },
      )
      return
    }

    logger.error("[runtime-ai] openai proxy websocket stream failed", {
      ...fields(),
      error: getErrorMessage(event.error ?? "upstream websocket error"),
      errorName: getErrorName(event.error),
      streamOutcome: "failed",
    })

    if (!downstreamClosed) {
      input.downstream.close(1011, "OpenAI Responses websocket failed.")
    }
  })

  upstream.addEventListener("close", (event) => {
    upstreamClosed = true
    const closeCode = getWebSocketCloseCode(event)
    const closeReason = getWebSocketCloseReason(event)
    const terminalEventType = observation.terminalEventType

    if (terminalEventType === "response.completed") {
      logger.info("[runtime-ai] openai proxy websocket stream completed", {
        ...fields(),
        closeCode,
        closeReason,
        streamOutcome: "completed",
      })
      return
    }

    if (
      terminalEventType === "response.failed" ||
      terminalEventType === "error"
    ) {
      logger.error("[runtime-ai] openai proxy websocket stream failed", {
        ...fields(),
        closeCode,
        closeReason,
        streamOutcome: "failed",
      })
      if (!downstreamClosed) {
        input.downstream.close(
          1011,
          `OpenAI Responses websocket failed with terminal event ${terminalEventType}.`,
        )
      }
      return
    }

    if (downstreamClosed) {
      logger.warn("[runtime-ai] openai proxy websocket upstream closed", {
        ...fields(),
        closeCode,
        closeReason,
        streamOutcome: "downstream_cancelled_before_terminal",
      })
      return
    }

    logger.error("[runtime-ai] openai proxy websocket stream incomplete", {
      ...fields(),
      closeCode,
      closeReason,
      streamOutcome: "incomplete",
    })
    input.downstream.close(
      1011,
      "OpenAI Responses websocket closed before terminal event.",
    )
  })

  return {
    handleDownstreamClose(event: { code?: number; reason?: string }) {
      downstreamClosed = true

      if (!observation.sawTerminal) {
        logger.warn(
          "[runtime-ai] openai proxy websocket downstream closed before terminal",
          {
            ...fields(),
            closeCode: event.code,
            closeReason: event.reason,
            streamOutcome: "downstream_cancelled_before_terminal",
          },
        )
      }

      if (!upstreamClosed) {
        upstream.close(event.code, event.reason)
      }
    },
    handleDownstreamMessage(data: unknown) {
      if (!upstreamOpen) {
        queuedDownstreamMessages.push(data)
        return
      }

      upstream.send(data)
    },
  }
}

export async function prepareOpenAiResponsesWebSocketProxy(input: {
  request: Request
  tenantId: string
}) {
  const requestId = randomUUID()
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

  return {
    apiKey,
    openclawSessionId: getCorrelationValue(
      input.request.headers,
      "x-openclaw-session-id",
    ),
    openclawTurnAttempt: getCorrelationValue(
      input.request.headers,
      "x-openclaw-turn-attempt",
    ),
    openclawTurnId: getCorrelationValue(
      input.request.headers,
      "x-openclaw-turn-id",
    ),
    requestId,
  }
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
  const requestShape =
    input.route === "responses"
      ? summarizeOpenAiResponsesRequestBody(bodyBuffer)
      : undefined
  let upstreamResponse: Response

  console.info("[runtime-ai] openai proxy request starting", {
    bodyBytes: bodyBuffer.byteLength,
    requestId,
    requestShape,
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
        requestSignal: input.request.signal,
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
    const firstLine = bodyBuffer
      .subarray(0, 200)
      .toString("utf-8")
      .split("\r\n")[0]
    if (firstLine.startsWith("--")) {
      const boundary = firstLine.slice(2)
      contentType = `multipart/form-data; boundary=${boundary}`
    } else {
      console.error("[audio-proxy] unexpected body encoding", {
        contentType: incomingContentType,
      })
    }
  }

  const prepared = await prepareOpenAiAudioTranscriptionProxyRequest({
    bodyBuffer,
    contentType,
    headers: input.request.headers,
    incomingContentType,
  })

  if (prepared.modelRepaired) {
    console.warn("[audio-proxy] repaired audio transcription model", {
      model: prepared.diagnostics.multipart?.model ?? null,
      resolvedModel: prepared.diagnostics.multipart?.resolvedModel ?? null,
      tenantId: input.tenantId,
    })
  }

  const upstreamHeaders = new Headers({
    Authorization: `Bearer ${apiKey}`,
  })
  if (prepared.contentType) {
    upstreamHeaders.set("Content-Type", prepared.contentType)
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(OPENAI_AUDIO_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: upstreamHeaders,
      body: prepared.body,
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
    const upstreamErrorBody = await upstreamResponse
      .clone()
      .text()
      .catch(describeUnknownError)

    console.error("[audio-proxy] upstream error", {
      model: prepared.diagnostics.multipart?.model ?? null,
      resolvedModel: prepared.diagnostics.multipart?.resolvedModel ?? null,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      tenantId: input.tenantId,
      upstreamErrorBody: truncateForLog(upstreamErrorBody),
    })
  }

  return new Response(upstreamResponse.body, {
    headers: buildOpenAiResponseHeaders(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  })
}
