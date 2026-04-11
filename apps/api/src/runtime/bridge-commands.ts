import { jsonNoStore } from "@otto/auth"
import { Hono } from "hono"
import * as z from "zod"

import { authenticateTenantRuntimeRequest } from "./auth"
import {
  claimNextTenantRuntimeBridgeCommand,
  completeTenantRuntimeBridgeCommand,
} from "./bridge-commands-data"

const claimBridgeCommandSchema = z.object({
  bridgeId: z.string().trim().min(1),
})

const completeBridgeCommandSchema = z.object({
  result: z.object({
    completedAt: z.string().trim().min(1).optional(),
    error: z.string().trim().min(1).optional(),
    exitCode: z.number().int().optional(),
    status: z.enum(["failed", "succeeded"]),
    stderr: z.string().optional(),
    stdout: z.string().optional(),
  }),
})

export type TenantRuntimeBridgeCommandsRouteDependencies = {
  authenticateTenantRuntime?: (request: Request) => Promise<{
    tenantId: string
  }>
  claimNextCommand: (input: {
    bridgeId: string
    tenantId: string
  }) => Promise<{
    command:
      | {
          commandId: string
        commandType: "conversation.trigger_message"
        payload: {
          assistantMessageId?: string
          conversationId: string
          message: string
        }
      }
      | null
    tenantId: string
  }>
  completeCommand: (input: {
    commandId: string
    result: {
      completedAt?: string
      error?: string
      exitCode?: number
      status: "failed" | "succeeded"
      stderr?: string
      stdout?: string
    }
    tenantId: string
  }) => Promise<{
    commandId: string
    status: string
    tenantId: string
  }>
}

function createDefaultDependencies(): TenantRuntimeBridgeCommandsRouteDependencies {
  return {
    authenticateTenantRuntime: authenticateTenantRuntimeRequest,
    claimNextCommand: claimNextTenantRuntimeBridgeCommand,
    completeCommand: completeTenantRuntimeBridgeCommand,
  }
}

function buildBridgeCommandErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return jsonNoStore(
      {
        error: "Invalid tenant runtime bridge command payload",
        issues: error.issues,
      },
      400,
    )
  }

  if (error instanceof Error) {
    return jsonNoStore(
      {
        error: error.message,
      },
      400,
    )
  }

  return jsonNoStore(
    {
      error: "Tenant runtime bridge command request failed.",
    },
    500,
  )
}

export function createTenantRuntimeBridgeCommandsRouter(
  dependencies: TenantRuntimeBridgeCommandsRouteDependencies = createDefaultDependencies(),
) {
  const app = new Hono()

  app.post("/api/internal/runtime/bridge/commands/claim", async (context) => {
    try {
      const { tenantId } = await (dependencies.authenticateTenantRuntime
        ? dependencies.authenticateTenantRuntime(context.req.raw)
        : authenticateTenantRuntimeRequest(context.req.raw))
      const payload = claimBridgeCommandSchema.parse(await context.req.json())
      const result = await dependencies.claimNextCommand({
        bridgeId: payload.bridgeId,
        tenantId,
      })

      return jsonNoStore({
        command: result.command,
        ok: true,
        tenantId: result.tenantId,
      })
    } catch (error) {
      return buildBridgeCommandErrorResponse(error)
    }
  })

  app.post(
    "/api/internal/runtime/bridge/commands/:commandId/complete",
    async (context) => {
      try {
        const { tenantId } = await (dependencies.authenticateTenantRuntime
          ? dependencies.authenticateTenantRuntime(context.req.raw)
          : authenticateTenantRuntimeRequest(context.req.raw))
        const payload = completeBridgeCommandSchema.parse(await context.req.json())
        const commandId = context.req.param("commandId")?.trim()

        if (!commandId) {
          throw new Error("commandId is required.")
        }

        const result = await dependencies.completeCommand({
          commandId,
          result: payload.result,
          tenantId,
        })

        return jsonNoStore({
          commandId: result.commandId,
          ok: true,
          status: result.status,
          tenantId: result.tenantId,
        })
      } catch (error) {
        return buildBridgeCommandErrorResponse(error)
      }
    },
  )

  return app
}

export function registerTenantRuntimeBridgeCommandRoutes(
  app: Hono,
  dependencies?: TenantRuntimeBridgeCommandsRouteDependencies,
) {
  return app.route("/", createTenantRuntimeBridgeCommandsRouter(dependencies))
}
