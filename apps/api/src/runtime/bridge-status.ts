import { jsonNoStore } from "@otto/auth"
import { Hono } from "hono"
import * as z from "zod"

import { authenticateTenantRuntimeRequest } from "./auth"
import { upsertTenantRuntimeBridgeStatus } from "./bridge-status-data"

const tenantRuntimeBridgeReportSchema = z.object({
  bridgeId: z.string().trim().min(1),
  gateway: z.object({
    healthy: z.boolean(),
    port: z.number().int().positive().optional(),
    statusCode: z.number().int().optional(),
  }),
  runtime: z.object({
    controlPlaneBaseUrl: z.string().trim().url().nullable().optional(),
    enabledPluginIds: z.array(z.string().trim().min(1)),
    installedPluginIds: z.array(z.string().trim().min(1)),
    sessionReporterEnabled: z.boolean(),
    workspaceChatEnabled: z.boolean(),
  }),
})

export type TenantRuntimeBridgeStatusReport = z.infer<
  typeof tenantRuntimeBridgeReportSchema
>

export type TenantRuntimeBridgeStatusRouteDependencies = {
  authenticateTenantRuntime?: (request: Request) => Promise<{
    tenantId: string
  }>
  recordBridgeStatus: (input: {
    report: TenantRuntimeBridgeStatusReport
    tenantId: string
  }) => Promise<{
    bridgeId: string
    status: string
    tenantId: string
  }>
}

function createDefaultDependencies(): TenantRuntimeBridgeStatusRouteDependencies {
  return {
    authenticateTenantRuntime: authenticateTenantRuntimeRequest,
    recordBridgeStatus: upsertTenantRuntimeBridgeStatus,
  }
}

function buildBridgeStatusErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return jsonNoStore(
      {
        error: "Invalid tenant runtime bridge payload",
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
      error: "Tenant runtime bridge request failed.",
    },
    500,
  )
}

export function createTenantRuntimeBridgeStatusRouter(
  dependencies: TenantRuntimeBridgeStatusRouteDependencies = createDefaultDependencies(),
) {
  const app = new Hono()

  app.post("/api/internal/runtime/bridge/report", async (context) => {
    try {
      const { tenantId } = await (dependencies.authenticateTenantRuntime
        ? dependencies.authenticateTenantRuntime(context.req.raw)
        : authenticateTenantRuntimeRequest(context.req.raw))
      const payload = tenantRuntimeBridgeReportSchema.parse(
        await context.req.json(),
      )
      const result = await dependencies.recordBridgeStatus({
        report: payload,
        tenantId,
      })

      return jsonNoStore({
        bridgeId: result.bridgeId,
        ok: true,
        status: result.status,
        tenantId: result.tenantId,
      })
    } catch (error) {
      return buildBridgeStatusErrorResponse(error)
    }
  })

  return app
}

export function registerTenantRuntimeBridgeStatusRoutes(
  app: Hono,
  dependencies?: TenantRuntimeBridgeStatusRouteDependencies,
) {
  return app.route("/", createTenantRuntimeBridgeStatusRouter(dependencies))
}
