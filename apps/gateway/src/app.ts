import {
  authenticateTenantRuntimeRequest,
  executeRuntimeIntegrationInGateway,
} from "@otto/feature-integrations-runtime"
import { Hono } from "hono"

import { buildExecutionErrorResponse } from "./error-response"

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  })
}

function clipForLog(value: string, max = 1000) {
  const trimmed = value.trim()

  if (trimmed.length <= max) {
    return trimmed
  }

  return `${trimmed.slice(0, max)}…`
}

function requireBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing runtime bearer token")
  }

  const tenantToken = authorization.slice("Bearer ".length).trim()

  if (!tenantToken) {
    throw new Error("Missing runtime bearer token")
  }

  return tenantToken
}

async function handleExecuteRequest(request: Request) {
  let tenantId: string | null = null
  let integrationKey = ""
  let commandKey = "unknown"
  let rawBodyText = ""

  try {
    requireBearerToken(request)
    const auth = await authenticateTenantRuntimeRequest(request)
    tenantId = auth.tenantId

    rawBodyText = await request.text()
    let parsedBody: unknown

    try {
      parsedBody = JSON.parse(rawBodyText)
    } catch {
      console.error(
        `[gateway] execute tenant=${tenantId ?? "unknown"} integration=unknown command=unknown invalid-json body=${clipForLog(rawBodyText)}`,
      )
      throw new Error("Failed to parse JSON")
    }

    const body =
      parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
        ? (parsedBody as Record<string, unknown>)
        : null

    if (!body) {
      throw new Error("Execute request body must be a JSON object.")
    }

    integrationKey =
      typeof body.integrationKey === "string" ? body.integrationKey : ""
    const providedCommandKey =
      typeof body.commandKey === "string" ? body.commandKey : ""
    const argumentsObject =
      body.arguments &&
      typeof body.arguments === "object" &&
      !Array.isArray(body.arguments)
        ? (body.arguments as Record<string, unknown>)
        : null
    const commandPath =
      Array.isArray(body.commandPath) &&
      body.commandPath.every((entry: unknown) => typeof entry === "string")
        ? (body.commandPath as string[])
        : null
    commandKey = providedCommandKey || commandPath?.join(".") || "unknown"

    if (!integrationKey.trim()) {
      throw new Error("integrationKey is required.")
    }

    if (!argumentsObject) {
      throw new Error("arguments must be an object.")
    }

    if (
      !providedCommandKey.trim() &&
      (!commandPath || commandPath.length === 0)
    ) {
      throw new Error("commandKey or commandPath is required.")
    }

    const result = await executeRuntimeIntegrationInGateway({
      arguments: argumentsObject,
      commandKey: providedCommandKey || undefined,
      commandPath: commandPath ?? undefined,
      integrationKey,
      tenantId,
    })

    console.info(
      `[gateway] execute tenant=${tenantId} integration=${integrationKey} command=${commandKey} ok=true`,
    )

    return json(result)
  } catch (error) {
    console.error(
      `[gateway] execute tenant=${tenantId ?? "unknown"} integration=${integrationKey || "unknown"} command=${commandKey} failed`,
      error,
    )
    return handleRouteErrorWithCommand(error, commandKey)
  }
}

function handleRouteErrorWithCommand(error: unknown, commandKey?: string) {
  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return json(
        {
          error: error.message,
        },
        401,
      )
    }

    return json(
      buildExecutionErrorResponse({
        commandKey,
        error,
      }),
      400,
    )
  }

  return json(
    {
      error: "Managed integration execution failed",
    },
    500,
  )
}

export function createGatewayApp() {
  const app = new Hono()

  app.get("/healthz", (context) => {
    return context.json(
      {
        ok: true,
        service: "gateway",
      },
      200,
      {
        "Cache-Control": "no-store",
      },
    )
  })

  app.post("/api/internal/runtime/integrations/execute", async (context) => {
    return handleExecuteRequest(context.req.raw)
  })

  app.notFound((context) => {
    return context.json(
      {
        error: "Not found",
      },
      404,
      {
        "Cache-Control": "no-store",
      },
    )
  })

  return app
}
