import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  integrationIngressDeliveries,
  integrationOauthConnections,
  tenantIntegrations,
} from "@otto/feature-integrations-runtime/db/schema"
import { and, desc, eq } from "drizzle-orm"

import {
  execTenantRuntimeCommand,
  getTenantRuntimeConnection,
} from "../tenant-runtime/ssh"

const OPENCLAW_GATEWAY_HOST_PORT = 18791
const TENANT_RUNTIME_SLACK_WEBHOOK_PATH = "/slack/events"
const SLACK_PROVIDER_KEY = "slack"

type SupportedSlackEndpointKey = "commands" | "events" | "interactivity"

type ForwardedGatewayHttpResponse = {
  body: string
  headers: Record<string, string>
  status: number
}

type ParsedSlackIngressRequest = {
  directResponse?: {
    body: string
    contentType: string
    status: number
  }
  enterpriseId: string | null
  teamId: string | null
}

export async function handleIntegrationWebhookRequest(input: {
  endpointKey: string
  provider: string
  request: Request
}) {
  if (input.provider !== SLACK_PROVIDER_KEY) {
    return Response.json(
      {
        error: `Unsupported integration ingress provider: ${input.provider}`,
      },
      { status: 404 },
    )
  }

  if (!isSupportedSlackEndpointKey(input.endpointKey)) {
    return Response.json(
      {
        error: `Unsupported ${input.provider} ingress endpoint: ${input.endpointKey}`,
      },
      { status: 404 },
    )
  }

  try {
    const body = await input.request.text()
    const parsed = parseSlackIngressRequest({
      body,
      requestType: input.endpointKey,
    })

    if (parsed.directResponse) {
      return new Response(parsed.directResponse.body, {
        headers: {
          "Content-Type": parsed.directResponse.contentType,
        },
        status: parsed.directResponse.status,
      })
    }

    if (!parsed.teamId) {
      return Response.json(
        {
          error: "Unable to determine Slack team_id for ingress routing.",
        },
        { status: 400 },
      )
    }

    const response = await forwardSlackIngressForTeam({
      body,
      enterpriseId: parsed.enterpriseId,
      headers: buildForwardedSlackHeaders(input.request),
      requestPath: new URL(input.request.url).pathname,
      requestType: input.endpointKey,
      teamId: parsed.teamId,
    })
    const headers = new Headers()
    const contentType =
      response.headers["content-type"] ?? "text/plain; charset=utf-8"

    headers.set("Content-Type", contentType)

    for (const headerName of ["x-slack-no-retry", "retry-after"]) {
      const value = response.headers[headerName]

      if (value) {
        headers.set(headerName, value)
      }
    }

    return new Response(response.body, {
      headers,
      status: response.status,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Slack ingress handling failed"
    const status = resolveSlackIngressErrorStatus(message)

    return Response.json(
      {
        error: message,
      },
      { status },
    )
  }
}

function isSupportedSlackEndpointKey(
  endpointKey: string,
): endpointKey is SupportedSlackEndpointKey {
  return (
    endpointKey === "events" ||
    endpointKey === "commands" ||
    endpointKey === "interactivity"
  )
}

function buildForwardedSlackHeaders(request: Request) {
  const forwarded: Record<string, string> = {}
  const contentType = request.headers.get("content-type")

  if (contentType) {
    forwarded["content-type"] = contentType
  }

  for (const headerName of [
    "x-slack-request-timestamp",
    "x-slack-signature",
    "x-slack-retry-num",
    "x-slack-retry-reason",
    "x-slack-no-retry",
    "user-agent",
  ]) {
    const value = request.headers.get(headerName)

    if (value) {
      forwarded[headerName] = value
    }
  }

  return forwarded
}

async function forwardSlackIngressForTeam(input: {
  body: string
  enterpriseId?: string | null
  headers: Record<string, string>
  requestPath: string
  requestType: SupportedSlackEndpointKey
  teamId: string
}) {
  const db = getDb()
  const target = await db.transaction(async (tx) => {
    const matches = await tx
      .select({
        connectedAt: tenantIntegrations.connectedAt,
        disconnectedAt: tenantIntegrations.disconnectedAt,
        slackTeamId: integrationOauthConnections.externalAccountId,
        tenantId: tenantIntegrations.tenantId,
        tenantIntegrationId: tenantIntegrations.id,
      })
      .from(tenantIntegrations)
      .innerJoin(
        integrationOauthConnections,
        eq(
          integrationOauthConnections.tenantIntegrationId,
          tenantIntegrations.id,
        ),
      )
      .where(
        and(
          eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
          eq(integrationOauthConnections.providerKey, SLACK_PROVIDER_KEY),
          eq(integrationOauthConnections.externalAccountId, input.teamId),
        ),
      )
      .orderBy(desc(tenantIntegrations.connectedAt))
      .limit(2)

    const connectedMatches = matches.filter(
      (match) =>
        match.connectedAt && !match.disconnectedAt && match.slackTeamId,
    )

    if (connectedMatches.length === 0) {
      return null
    }

    if (connectedMatches.length > 1) {
      throw new Error(
        `Multiple tenants are connected to Slack team ${input.teamId}.`,
      )
    }

    return connectedMatches[0] ?? null
  })

  if (!target) {
    throw new Error(
      `No connected Slack installation was found for team ${input.teamId}.`,
    )
  }

  const [delivery] = await db
    .insert(integrationIngressDeliveries)
    .values({
      endpointKey: input.requestType,
      externalAccountId: input.enterpriseId ?? null,
      externalWorkspaceId: input.teamId,
      providerKey: SLACK_PROVIDER_KEY,
      providerMetadata: {},
      requestPath: input.requestPath,
      status: "forwarding",
      tenantIntegrationId: target.tenantIntegrationId,
    })
    .returning({
      id: integrationIngressDeliveries.id,
    })

  try {
    const connection = await getTenantRuntimeConnection(
      target.tenantId,
      `Slack ${input.requestType} ingress`,
    )
    const response = await forwardGatewayHttpRequest(connection, {
      body: input.body,
      headers: input.headers,
      path: TENANT_RUNTIME_SLACK_WEBHOOK_PATH,
    })
    const finishedAt = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(integrationIngressDeliveries)
        .set({
          finishedAt,
          responseStatus: response.status,
          status: "forwarded",
        })
        .where(eq(integrationIngressDeliveries.id, delivery.id))

      await tx
        .update(tenantIntegrations)
        .set({
          lastError: null,
          lastErrorAt: null,
          updatedAt: finishedAt,
        })
        .where(eq(tenantIntegrations.id, target.tenantIntegrationId))
    })

    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Slack ingress forwarding failed"
    const finishedAt = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(integrationIngressDeliveries)
        .set({
          error: message,
          finishedAt,
          status: "failed",
        })
        .where(eq(integrationIngressDeliveries.id, delivery.id))

      await tx
        .update(tenantIntegrations)
        .set({
          lastError: message,
          lastErrorAt: finishedAt,
          updatedAt: finishedAt,
        })
        .where(eq(tenantIntegrations.id, target.tenantIntegrationId))
    })

    throw error
  }
}

async function forwardGatewayHttpRequest(
  connection: Awaited<ReturnType<typeof getTenantRuntimeConnection>>,
  input: {
    body: string
    headers: Record<string, string>
    path: string
    timeoutMs?: number
  },
): Promise<ForwardedGatewayHttpResponse> {
  const forwardedHeaders = Object.entries(input.headers)
    .filter(([, value]) => value.trim().length > 0)
    .map(([name, value]) => `-H ${shellQuote(`${name}: ${value}`)}`)
    .join(" ")
  const targetUrl = `http://127.0.0.1:${OPENCLAW_GATEWAY_HOST_PORT}${input.path}`
  const bodyBase64 = Buffer.from(input.body, "utf8").toString("base64")
  const script = [
    "set -euo pipefail",
    "request_body_path=$(mktemp /tmp/otto-slack-ingress-body.XXXXXX)",
    "response_body=$(mktemp /tmp/otto-slack-ingress-response-body.XXXXXX)",
    "response_headers=$(mktemp /tmp/otto-slack-ingress-response-headers.XXXXXX)",
    'trap \'rm -f "$request_body_path" "$response_body" "$response_headers"\' EXIT',
    `printf '%s' ${shellQuote(bodyBase64)} | base64 -d > "$request_body_path"`,
    [
      "status=$(curl -sS",
      `--max-time ${Math.max(5, Math.ceil((input.timeoutMs ?? 30_000) / 1000))}`,
      '-o "$response_body"',
      '-D "$response_headers"',
      "-X POST",
      forwardedHeaders,
      '--data-binary @"$request_body_path"',
      shellQuote(targetUrl),
      "-w '%{http_code}')",
    ]
      .filter(Boolean)
      .join(" "),
    [
      'printf \'{"status":%s,"headersBase64":"%s","bodyBase64":"%s"}\'',
      '"$status"',
      '"$(base64 < "$response_headers" | tr -d \'\\n\')"',
      '"$(base64 < "$response_body" | tr -d \'\\n\')"',
    ].join(" "),
  ].join("\n")
  const result = await execTenantRuntimeCommand(
    connection,
    `bash -lc ${shellQuote(script)}`,
  )

  if (result.exitCode !== 0) {
    throw new Error(
      `Tenant gateway HTTP forward failed: ${result.stderr || result.stdout || "Remote command failed"}`,
    )
  }

  return parseForwardedGatewayHttpPayload(result.stdout)
}

function parseForwardedGatewayHttpPayload(
  value: string,
): ForwardedGatewayHttpResponse {
  const envelope = parseJsonObject(value)
  const status = envelope.status

  if (typeof status !== "number") {
    throw new Error("Tenant runtime forwarded HTTP response is missing status")
  }

  const headersRaw = Buffer.from(
    typeof envelope.headersBase64 === "string" ? envelope.headersBase64 : "",
    "base64",
  ).toString("utf8")
  const body = Buffer.from(
    typeof envelope.bodyBase64 === "string" ? envelope.bodyBase64 : "",
    "base64",
  ).toString("utf8")

  return {
    body,
    headers: parseRawHttpHeaders(headersRaw),
    status,
  }
}

function parseRawHttpHeaders(value: string) {
  const headers: Record<string, string> = {}

  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("HTTP/")) {
      continue
    }

    const separatorIndex = trimmed.indexOf(":")

    if (separatorIndex <= 0) {
      continue
    }

    const name = trimmed.slice(0, separatorIndex).trim().toLowerCase()
    const headerValue = trimmed.slice(separatorIndex + 1).trim()

    if (!name || !headerValue) {
      continue
    }

    headers[name] = headerValue
  }

  return headers
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected JSON object")
    }

    return parsed as Record<string, unknown>
  } catch {
    throw new Error("Tenant runtime returned an invalid forwarded HTTP payload")
  }
}

function resolveSlackIngressErrorStatus(message: string) {
  if (
    message.startsWith("No connected Slack installation") ||
    message.startsWith("Multiple tenants are connected")
  ) {
    return 404
  }

  if (message.includes("Unable to determine Slack team_id")) {
    return 400
  }

  return 502
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function parseSlackIngressRequest(input: {
  body: string
  requestType: SupportedSlackEndpointKey
}): ParsedSlackIngressRequest {
  switch (input.requestType) {
    case "events":
      return parseSlackEventRequest(input.body)
    case "commands":
      return parseSlackCommandRequest(input.body)
    case "interactivity":
      return parseSlackInteractivityRequest(input.body)
  }
}

function parseSlackEventRequest(body: string): ParsedSlackIngressRequest {
  const payload = parseJsonRecord(body)

  if (
    payload?.type === "url_verification" &&
    typeof payload.challenge === "string"
  ) {
    return {
      directResponse: {
        body: payload.challenge,
        contentType: "text/plain; charset=utf-8",
        status: 200,
      },
      enterpriseId: readString(payload.enterprise_id),
      teamId: readString(payload.team_id),
    }
  }

  const authorizations = Array.isArray(payload?.authorizations)
    ? payload.authorizations
    : []
  const firstAuthorization = authorizations.find(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value),
  )

  return {
    enterpriseId:
      readString(payload?.enterprise_id) ??
      readString(firstAuthorization?.enterprise_id),
    teamId:
      readString(payload?.team_id) ?? readString(firstAuthorization?.team_id),
  }
}

function parseSlackCommandRequest(body: string): ParsedSlackIngressRequest {
  const form = new URLSearchParams(body)

  if (form.get("ssl_check") === "1") {
    return {
      directResponse: {
        body: "",
        contentType: "text/plain; charset=utf-8",
        status: 200,
      },
      enterpriseId: readString(form.get("enterprise_id")),
      teamId: readString(form.get("team_id")),
    }
  }

  return {
    enterpriseId: readString(form.get("enterprise_id")),
    teamId: readString(form.get("team_id")),
  }
}

function parseSlackInteractivityRequest(
  body: string,
): ParsedSlackIngressRequest {
  const form = new URLSearchParams(body)

  if (form.get("ssl_check") === "1") {
    return {
      directResponse: {
        body: "",
        contentType: "text/plain; charset=utf-8",
        status: 200,
      },
      enterpriseId: null,
      teamId: null,
    }
  }

  const payload = parseJsonRecord(form.get("payload") ?? "")
  const team = asRecord(payload?.team)
  const user = asRecord(payload?.user)

  return {
    enterpriseId:
      readString(payload?.enterprise_id) ??
      readString(team?.enterprise_id) ??
      readString(user?.enterprise_id),
    teamId:
      readString(team?.id) ??
      readString(payload?.team_id) ??
      readString(user?.team_id),
  }
}

function parseJsonRecord(value: string) {
  if (!value.trim()) {
    return null
  }

  try {
    return asRecord(JSON.parse(value))
  } catch {
    return null
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
