import { jsonNoStore } from "@otto/auth"
import {
  handleManagedConfigGetRequest,
  handleManagedConfigPatchRequest,
  handleManagedSkillsDeleteRequest,
  handleManagedSkillsGetRequest,
  handleManagedSkillsInstallFromLibraryRequest,
  handleManagedSkillsLibraryGetRequest,
  handleManagedSkillsPostRequest,
  handleManagedSkillsResetRequest,
  handleManagedSkillsUpdateRequest,
  type ManagedConfigVersionConflictLike,
  type ManagedSkillVersionConflictLike,
} from "@otto/feature-runtime-core"
import {
  listTenantScheduledTasks,
  replaceTenantScheduledTasksSnapshot,
  upsertTenantScheduledTaskRuns,
} from "@otto/feature-runtime-core/scheduled-tasks/queries"
import {
  normalizeRuntimeRun,
  normalizeRuntimeTask,
  type RuntimeCronJob,
  type RuntimeCronRun,
} from "@otto/feature-runtime-core/scheduled-tasks/sync"
import {
  type TenantSessionUpsertInput,
  upsertTenantSessionBatch,
} from "@otto/feature-runtime-core/sessions/queries"
import type { Hono } from "hono"
import { z } from "zod"

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"
import { authenticateTenantRuntimeRequest } from "./auth"
import {
  enableRuntimeIntegrationForTenant,
  applyRuntimeIntegrationSettingsForTenant,
  findRuntimeIntegrationCommandsForTenant,
  getRuntimeIntegrationConnectionActionForTenant,
  getRuntimeIntegrationDetailsForTenant,
  getRuntimeIntegrationForTenant,
  getRuntimeIntegrationSettingsForTenant,
  listRuntimeIntegrationsForTenant,
  validateRuntimeIntegrationSettingsForTenant,
} from "./integrations"
import { manageRuntimeIntegrationConnection } from "./integration-management"
import {
  getLatestTenantManagedConfig,
  ManagedConfigVersionConflictError,
  normalizeManagedBootstrapFilePath,
  updateTenantManagedFileSharedContentForTenant,
} from "./managed-config/data"
import {
  createTenantManagedSkillForTenant,
  deleteTenantManagedSkillForTenant,
  getLatestTenantManagedSkillDetailForTenant,
  installTenantManagedSkillFromLibraryForTenant,
  listTenantManagedSkillLibraryEntriesForTenant,
  listTenantManagedSkillsForTenant,
  ManagedSkillVersionConflictError,
  resetTenantManagedSkillPackageForTenant,
  updateTenantManagedSkillForTenant,
} from "./managed-skills-data"
import {
  OpenAiProxyError,
  createOpenAiResponsesWebSocketBridge,
  prepareOpenAiResponsesWebSocketProxy,
  proxyOpenAiAudioTranscriptionsRequest,
  proxyOpenAiResponsesRequest,
} from "./openai-proxy"
import {
  proxyRuntimeWebSearchRequest,
  RuntimeWebSearchProxyError,
} from "./web-search"
import { registerTenantRuntimeBridgeStatusRoutes } from "./bridge-status"
import { handleIntegrationWebhookRequest } from "./integration-webhooks"
import { registerWorkspaceChatRuntimeRoutes } from "./workspace-chat"
import { TenantRuntimeConfigVersionConflictError } from "./slack-settings"
import { handleStripeWebhookRequest } from "../webhooks/stripe"
import { handleWorkOsWebhookRequest } from "../webhooks/workos"

const OPENAI_RESPONSES_PROXY_PATH =
  "/api/internal/runtime/ai/openai/v1/responses"
const OPENAI_RESPONSES_WEBSOCKET_PROXY_CONTEXT_KEY =
  "openAiResponsesWebSocketProxy"

type OpenAiResponsesWebSocketPreparedProxy = {
  tenantId: string
  proxy: Awaited<ReturnType<typeof prepareOpenAiResponsesWebSocketProxy>>
}

type OpenAiResponsesWebSocketContext = {
  get: (
    key: typeof OPENAI_RESPONSES_WEBSOCKET_PROXY_CONTEXT_KEY,
  ) => OpenAiResponsesWebSocketPreparedProxy | undefined
  set: (
    key: typeof OPENAI_RESPONSES_WEBSOCKET_PROXY_CONTEXT_KEY,
    value: OpenAiResponsesWebSocketPreparedProxy,
  ) => void
}

function setOpenAiResponsesWebSocketPreparedProxy(
  context: unknown,
  value: OpenAiResponsesWebSocketPreparedProxy,
) {
  const typedContext = context as OpenAiResponsesWebSocketContext
  typedContext.set(
    OPENAI_RESPONSES_WEBSOCKET_PROXY_CONTEXT_KEY,
    value,
  )
}

function getOpenAiResponsesWebSocketPreparedProxy(context: unknown) {
  const typedContext = context as OpenAiResponsesWebSocketContext
  return typedContext.get(
    OPENAI_RESPONSES_WEBSOCKET_PROXY_CONTEXT_KEY,
  )
}

export function registerRuntimeRoutes(app: Hono) {
  registerWorkspaceChatRuntimeRoutes(app)
  registerTenantRuntimeBridgeStatusRoutes(app)

  app.post("/api/webhooks/integrations/:provider/:endpointKey", (context) => {
    return handleIntegrationWebhookRequest({
      endpointKey: context.req.param("endpointKey") ?? "",
      provider: context.req.param("provider") ?? "",
      request: context.req.raw,
    })
  })

  app.get("/api/internal/runtime/integrations", async (context) => {
    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )
      const url = new URL(context.req.raw.url)
      const scopeParam = (url.searchParams.get("scope") ?? "installed")
        .trim()
        .toLowerCase()
      const scope =
        scopeParam === "available" || scopeParam === "all"
          ? scopeParam
          : "installed"
      const integrations = await listRuntimeIntegrationsForTenant({
        scope,
        tenantId,
      })

      return jsonNoStore({
        integrations,
        scope,
      })
    } catch (error) {
      return handleRuntimeIntegrationError(error)
    }
  })

  app.get("/api/internal/runtime/integrations/catalog", async (context) => {
    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )
      const integrations = await listRuntimeIntegrationsForTenant({
        scope: "available",
        tenantId,
      })

      return jsonNoStore({ integrations })
    } catch (error) {
      return handleRuntimeIntegrationError(error)
    }
  })

  app.post("/api/internal/runtime/integrations/find", async (context) => {
    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )
      const body = (await context.req.raw.json().catch(() => null)) as {
        limit?: number
        query?: string
        scope?: string
      } | null
      const query = typeof body?.query === "string" ? body.query : ""
      const scope =
        body?.scope === "all" ||
        body?.scope === "available" ||
        body?.scope === "installed"
          ? body.scope
          : "installed"
      const limit =
        typeof body?.limit === "number" &&
        Number.isInteger(body.limit) &&
        body.limit >= 1 &&
        body.limit <= 50
          ? body.limit
          : 10

      if (!query.trim()) {
        return jsonNoStore(
          {
            code: "runtime_integrations_failed",
            message: "query is required.",
          },
          400,
        )
      }

      const result = await findRuntimeIntegrationCommandsForTenant({
        query,
        tenantId,
      })
      const allowedKeys = new Set(
        (
          await listRuntimeIntegrationsForTenant({
            scope,
            tenantId,
          })
        ).map((integration) => integration.key),
      )
      const matches = result.matches.filter((match) =>
        allowedKeys.has(match.integrationKey),
      )

      return jsonNoStore({
        matches: matches.slice(0, limit),
        query: result.query,
        scope,
      })
    } catch (error) {
      return handleRuntimeIntegrationError(error)
    }
  })

  app.get(
    "/api/internal/runtime/integrations/:integrationKey",
    async (context) => {
      try {
        const { tenantId } = await authenticateTenantRuntimeRequest(
          context.req.raw,
        )
        const integrationKey = context.req.param("integrationKey") ?? ""

        if (!integrationKey.trim()) {
          throw new Error("integrationKey is required.")
        }

        const integration = await getRuntimeIntegrationForTenant({
          integrationKey,
          tenantId,
        })

        if (!integration) {
          return jsonNoStore(
            {
              code: "not_found",
              message: `Managed integration ${integrationKey} is not available in this runtime.`,
            },
            404,
          )
        }

        return jsonNoStore({ integration })
      } catch (error) {
        return handleRuntimeIntegrationError(error)
      }
    },
  )

  app.post(
    "/api/internal/runtime/integrations/:integrationKey/details",
    async (context) => {
      try {
        const { tenantId } = await authenticateTenantRuntimeRequest(
          context.req.raw,
        )
        const integrationKey = context.req.param("integrationKey") ?? ""
        const body = (await context.req.raw.json().catch(() => null)) as {
          detailKey?: string
          detailType?: string
        } | null
        const detailType =
          body?.detailType === "command" || body?.detailType === "command_group"
            ? body.detailType
            : null
        const detailKey =
          typeof body?.detailKey === "string" ? body.detailKey : ""

        if (!integrationKey.trim()) {
          throw new Error("integrationKey is required.")
        }

        if (!detailType) {
          throw new Error("detailType must be command or command_group.")
        }

        if (!detailKey.trim()) {
          throw new Error("detailKey is required.")
        }

        const details = await getRuntimeIntegrationDetailsForTenant({
          detailKey,
          detailType,
          integrationKey,
          tenantId,
        })

        if (!details) {
          return jsonNoStore(
            {
              code: "not_found",
              message: `${detailType} ${detailKey} is not available on integration ${integrationKey}.`,
            },
            404,
          )
        }

        return jsonNoStore({ details })
      } catch (error) {
        return handleRuntimeIntegrationError(error)
      }
    },
  )

  app.post(
    "/api/internal/runtime/integrations/:integrationKey/connection",
    async (context) => {
      try {
        const { tenantId } = await authenticateTenantRuntimeRequest(
          context.req.raw,
        )
        const integrationKey = context.req.param("integrationKey") ?? ""
        const body = (await context.req.raw.json().catch(() => ({}))) as {
          action?: string
        }
        const action = typeof body?.action === "string" ? body.action : "auto"

        if (!integrationKey.trim()) {
          throw new Error("integrationKey is required.")
        }

        const connectionAction = await manageRuntimeIntegrationConnection({
          action,
          enableRuntimeIntegrationForTenant,
          getRuntimeIntegrationConnectionActionForTenant,
          integrationKey,
          tenantId,
        })

        if (!connectionAction) {
          return jsonNoStore(
            {
              code: "not_found",
              message: `Managed integration ${integrationKey} is not available in this runtime.`,
            },
            404,
          )
        }

        return jsonNoStore({ connectionAction })
      } catch (error) {
        return handleRuntimeIntegrationError(error)
      }
    },
  )

  app.get(
    "/api/internal/runtime/integrations/:integrationKey/settings",
    async (context) => {
      try {
        const { tenantId } = await authenticateTenantRuntimeRequest(
          context.req.raw,
        )
        const integrationKey = context.req.param("integrationKey") ?? ""

        if (!integrationKey.trim()) {
          throw new Error("integrationKey is required.")
        }

        const settings = await getRuntimeIntegrationSettingsForTenant({
          integrationKey,
          tenantId,
        })

        if (!settings) {
          return jsonNoStore(
            {
              code: "not_found",
              message: `Managed integration ${integrationKey} does not expose configurable settings.`,
            },
            404,
          )
        }

        return jsonNoStore(settings)
      } catch (error) {
        return handleRuntimeIntegrationSettingsError(error)
      }
    },
  )

  app.post(
    "/api/internal/runtime/integrations/:integrationKey/settings",
    async (context) => {
      try {
        const { tenantId } = await authenticateTenantRuntimeRequest(
          context.req.raw,
        )
        const integrationKey = context.req.param("integrationKey") ?? ""

        if (!integrationKey.trim()) {
          throw new Error("integrationKey is required.")
        }

        const body = (await context.req.raw.json().catch(() => null)) as {
          action?: string
          expectedEntryVersion?: number
          patch?: Record<string, unknown>
          summary?: string
        } | null
        const action = body?.action === "apply" ? "apply" : "validate"

        if (
          !body?.patch ||
          typeof body.patch !== "object" ||
          Array.isArray(body.patch)
        ) {
          throw new Error("patch must be an object.")
        }

        const result =
          action === "apply"
            ? await applyRuntimeIntegrationSettingsForTenant({
                expectedEntryVersion: body.expectedEntryVersion,
                integrationKey,
                patch: body.patch,
                summary: body.summary,
                tenantId,
              })
            : await validateRuntimeIntegrationSettingsForTenant({
                integrationKey,
                patch: body.patch,
                tenantId,
              })

        if (!result) {
          return jsonNoStore(
            {
              code: "not_found",
              message: `Managed integration ${integrationKey} does not expose configurable settings.`,
            },
            404,
          )
        }

        return jsonNoStore(result)
      } catch (error) {
        return handleRuntimeIntegrationSettingsError(error)
      }
    },
  )

  app.post("/api/internal/runtime/integrations/execute", async (context) => {
    const upstreamUrl = `${process.env.INTEGRATION_GATEWAY_INTERNAL_URL ?? "http://integration-gateway:3001"}/api/internal/runtime/integrations/execute`
    const requestBody = await context.req.raw.text()

    try {
      const upstreamHeaders = new Headers()
      const authorization = context.req.header("authorization")
      const contentType = context.req.header("content-type")

      if (authorization) {
        upstreamHeaders.set("authorization", authorization)
      }

      if (contentType) {
        upstreamHeaders.set("content-type", contentType)
      }

      const upstreamResponse = await fetch(upstreamUrl, {
        body: requestBody,
        headers: upstreamHeaders,
        method: "POST",
      })

      return new Response(upstreamResponse.body, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type":
            upstreamResponse.headers.get("content-type") ?? "application/json",
        },
        status: upstreamResponse.status,
      })
    } catch (error) {
      console.error(
        "[runtime-integrations] execute gateway proxy failed",
        error,
      )

      return jsonNoStore(
        {
          error: "Integration gateway unavailable",
        },
        502,
      )
    }
  })

  app.post(OPENAI_RESPONSES_PROXY_PATH, async (context) => {
    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )

      return await proxyOpenAiResponsesRequest({
        request: context.req.raw,
        tenantId,
      })
    } catch (error) {
      return handleOpenAiProxyError(error)
    }
  })

  app.use(OPENAI_RESPONSES_PROXY_PATH, async (context, next) => {
    if (context.req.method !== "GET") {
      return next()
    }
    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )
      const proxy = await prepareOpenAiResponsesWebSocketProxy({
        request: context.req.raw,
        tenantId,
      })

      setOpenAiResponsesWebSocketPreparedProxy(context, {
        proxy,
        tenantId,
      })
      return next()
    } catch (error) {
      return handleOpenAiProxyError(error)
    }
  })

  app.get(
    OPENAI_RESPONSES_PROXY_PATH,
    async (context, next) => {
      const { upgradeWebSocket } = await import("hono/bun")

      return upgradeWebSocket((webSocketContext) => {
        const prepared =
          getOpenAiResponsesWebSocketPreparedProxy(webSocketContext)

        if (!prepared) {
          throw new OpenAiProxyError(
            "OpenAI Responses WebSocket proxy was not prepared.",
            500,
          )
        }

        const { proxy, tenantId } = prepared
        let bridge:
          | ReturnType<typeof createOpenAiResponsesWebSocketBridge>
          | undefined

        return {
          onClose(event) {
            bridge?.handleDownstreamClose({
              code: event.code,
              reason: event.reason,
            })
          },
          onMessage(event) {
            bridge?.handleDownstreamMessage(event.data)
          },
          onOpen(_, ws) {
            bridge = createOpenAiResponsesWebSocketBridge({
              apiKey: proxy.apiKey,
              downstream: {
                close(code, reason) {
                  ws.close(code, reason)
                },
                send(data) {
                  ws.send(data as string)
                },
              },
              openclawSessionId: proxy.openclawSessionId,
              openclawTurnAttempt: proxy.openclawTurnAttempt,
              openclawTurnId: proxy.openclawTurnId,
              requestId: proxy.requestId,
              tenantId,
            })
          },
        }
      })(context, next)
    },
  )

  app.post(
    "/api/internal/runtime/ai/openai/v1/audio/transcriptions",
    async (context) => {
      try {
        const { tenantId } = await authenticateTenantRuntimeRequest(
          context.req.raw,
        )

        return await proxyOpenAiAudioTranscriptionsRequest({
          request: context.req.raw,
          tenantId,
        })
      } catch (error) {
        return handleOpenAiProxyError(error)
      }
    },
  )

  app.post("/api/internal/runtime/web-search/search", async (context) => {
    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )

      return await proxyRuntimeWebSearchRequest({
        request: context.req.raw,
        tenantId,
      })
    } catch (error) {
      return handleRuntimeWebSearchError(error)
    }
  })

  app.get("/api/internal/runtime/managed-config", async (context) => {
    return handleManagedConfigGetRequest({
      authenticateTenantRuntimeRequest,
      getLatestTenantManagedConfig,
      normalizeManagedBootstrapFilePath,
      request: context.req.raw,
    })
  })

  app.patch("/api/internal/runtime/managed-config", async (context) => {
    return handleManagedConfigPatchRequest({
      authenticateTenantRuntimeRequest,
      isVersionConflictError: (
        error,
      ): error is ManagedConfigVersionConflictLike =>
        error instanceof ManagedConfigVersionConflictError,
      normalizeManagedBootstrapFilePath,
      request: context.req.raw,
      updateTenantManagedFileSharedContentForTenant,
    })
  })

  app.get("/api/internal/runtime/managed-skills", async (context) => {
    return handleManagedSkillsGetRequest({
      authenticateTenantRuntimeRequest,
      getLatestTenantManagedSkillDetailForTenant,
      listTenantManagedSkillsForTenant,
      request: context.req.raw,
    })
  })

  app.get("/api/internal/runtime/managed-skills/library", async (context) => {
    return handleManagedSkillsLibraryGetRequest({
      authenticateTenantRuntimeRequest,
      listTenantManagedSkillLibraryEntriesForTenant,
      request: context.req.raw,
    })
  })

  app.post("/api/internal/runtime/managed-skills", async (context) => {
    return handleManagedSkillsPostRequest({
      authenticateTenantRuntimeRequest,
      createTenantManagedSkillForTenant,
      request: context.req.raw,
    })
  })

  app.post(
    "/api/internal/runtime/managed-skills/library/install",
    async (context) => {
      return handleManagedSkillsInstallFromLibraryRequest({
        authenticateTenantRuntimeRequest,
        installTenantManagedSkillFromLibraryForTenant,
        request: context.req.raw,
      })
    },
  )

  app.patch("/api/internal/runtime/managed-skills", async (context) => {
    return handleManagedSkillsUpdateRequest({
      authenticateTenantRuntimeRequest,
      isVersionConflictError: (
        error,
      ): error is ManagedSkillVersionConflictLike =>
        error instanceof ManagedSkillVersionConflictError,
      request: context.req.raw,
      updateTenantManagedSkillForTenant,
    })
  })

  app.delete("/api/internal/runtime/managed-skills", async (context) => {
    return handleManagedSkillsDeleteRequest({
      authenticateTenantRuntimeRequest,
      deleteTenantManagedSkillForTenant,
      isVersionConflictError: (
        error,
      ): error is ManagedSkillVersionConflictLike =>
        error instanceof ManagedSkillVersionConflictError,
      request: context.req.raw,
    })
  })

  app.post("/api/internal/runtime/managed-skills/reset", async (context) => {
    return handleManagedSkillsResetRequest({
      authenticateTenantRuntimeRequest,
      isVersionConflictError: (
        error,
      ): error is ManagedSkillVersionConflictLike =>
        error instanceof ManagedSkillVersionConflictError,
      request: context.req.raw,
      resetTenantManagedSkillPackageForTenant,
    })
  })

  app.post("/api/internal/runtime/sessions/sync", async (context) => {
    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )
      const body = await context.req.raw.json()
      const sessions = validateSessionSyncPayload(body)

      await upsertTenantSessionBatch(tenantId, sessions)

      return jsonNoStore({
        ok: true,
        synced: sessions.length,
      })
    } catch (error) {
      return handleSessionSyncError(error)
    }
  })

  app.post("/api/internal/runtime/scheduled-tasks/sync", async (context) => {
    const startedAt = Date.now()
    let syncLogContext: Record<string, unknown> = {}

    try {
      const { tenantId } = await authenticateTenantRuntimeRequest(
        context.req.raw,
      )
      syncLogContext = { tenantId }
      const body = await context.req.raw.json()
      const payload = validateScheduledTaskSyncPayload(body)
      syncLogContext = {
        reason: payload.reason,
        runsCount: payload.runs?.length ?? 0,
        source: payload.source,
        tasksCount: payload.tasks?.length ?? null,
        tenantId,
      }

      console.info(
        "[runtime-scheduled-tasks] sync callback received",
        syncLogContext,
      )

      const taskSnapshots = (payload.tasks ?? [])
        .map(normalizeRuntimeTask)
        .filter(
          (
            task,
          ): task is NonNullable<ReturnType<typeof normalizeRuntimeTask>> =>
            task !== null,
        )

      const taskNameByKey = new Map(
        taskSnapshots.map((task) => [task.taskKey, task.name] as const),
      )

      if (payload.runs) {
        const runJobIds = new Set(
          payload.runs
            .map((run) => run.jobId)
            .filter(
              (id): id is string =>
                typeof id === "string" &&
                id.trim().length > 0 &&
                !taskNameByKey.has(id),
            ),
        )

        if (runJobIds.size > 0) {
          const existingTasks = await listTenantScheduledTasks({ tenantId })
          for (const task of existingTasks) {
            if (runJobIds.has(task.taskKey)) {
              taskNameByKey.set(task.taskKey, task.name)
            }
          }
        }
      }

      const runSnapshots = (payload.runs ?? [])
        .map((run) => {
          const taskKey =
            typeof run.jobId === "string" && run.jobId.trim().length > 0
              ? run.jobId
              : null

          return normalizeRuntimeRun(run, {
            taskKey,
            taskName: taskKey ? (taskNameByKey.get(taskKey) ?? null) : null,
          })
        })
        .filter(
          (run): run is NonNullable<ReturnType<typeof normalizeRuntimeRun>> =>
            run !== null,
        )

      if (payload.tasks) {
        await replaceTenantScheduledTasksSnapshot({
          tasks: taskSnapshots,
          tenantId,
        })
      }

      if (runSnapshots.length > 0) {
        await upsertTenantScheduledTaskRuns({
          runs: runSnapshots,
          tenantId,
        })

        await enqueueJob({
          jobType: JOB_TYPES.syncTenantSessions,
          payload: { tenantId },
        }).catch(() => undefined)
      }

      console.info("[runtime-scheduled-tasks] sync callback applied", {
        ...syncLogContext,
        durationMs: Date.now() - startedAt,
        syncedRuns: runSnapshots.length,
        syncedTasks: taskSnapshots.length,
      })

      return jsonNoStore({
        ok: true,
        reason: payload.reason,
        source: payload.source,
        syncedRuns: runSnapshots.length,
        syncedTasks: taskSnapshots.length,
      })
    } catch (error) {
      console.error("[runtime-scheduled-tasks] sync callback failed", {
        ...syncLogContext,
        durationMs: Date.now() - startedAt,
        ...describeRuntimeRouteError(error),
      })
      return handleScheduledTaskSyncError(error)
    }
  })

  app.post("/webhooks/workos", (context) =>
    handleWorkOsWebhookRequest(context.req.raw),
  )
  app.post("/webhooks/stripe", (context) =>
    handleStripeWebhookRequest(context.req.raw),
  )
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

const MAX_SESSIONS_PER_REQUEST = 50

function optString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function optNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function validateSessionSyncPayload(body: unknown): TenantSessionUpsertInput[] {
  if (!body || typeof body !== "object" || !("sessions" in body)) {
    throw new ValidationError("Request body must contain a sessions array")
  }

  const { sessions } = body as { sessions: unknown }

  if (!Array.isArray(sessions)) {
    throw new ValidationError("sessions must be an array")
  }

  if (sessions.length === 0) {
    throw new ValidationError("sessions array must not be empty")
  }

  if (sessions.length > MAX_SESSIONS_PER_REQUEST) {
    throw new ValidationError(
      `sessions array must not exceed ${MAX_SESSIONS_PER_REQUEST} items`,
    )
  }

  return sessions.map((session, index) => {
    if (!session || typeof session !== "object") {
      throw new ValidationError(`sessions[${index}] must be an object`)
    }

    const record = session as Record<string, unknown>

    if (
      typeof record.sessionKey !== "string" ||
      record.sessionKey.trim().length === 0
    ) {
      throw new ValidationError(
        `sessions[${index}].sessionKey must be a non-empty string`,
      )
    }

    if (
      typeof record.status !== "string" ||
      record.status.trim().length === 0
    ) {
      throw new ValidationError(
        `sessions[${index}].status must be a non-empty string`,
      )
    }

    return {
      cacheReadTokens: optNumber(record.cacheReadTokens),
      cacheWriteTokens: optNumber(record.cacheWriteTokens),
      channel: optString(record.channel),
      channelProvider: optString(record.channelProvider),
      chatType: optString(record.chatType),
      displayName: optString(record.displayName),
      endedAt: optNumber(record.endedAt),
      estimatedCostUsd: optString(record.estimatedCostUsd),
      externalSessionId: optString(record.externalSessionId),
      inputTokens: optNumber(record.inputTokens),
      label: optString(record.label),
      lastMessageAt: optNumber(record.lastMessageAt),
      messageCount: optNumber(record.messageCount),
      model: optString(record.model),
      modelProvider: optString(record.modelProvider),
      originAccountId: optString(record.originAccountId),
      originFrom: optString(record.originFrom),
      originThreadId: optString(record.originThreadId),
      originTo: optString(record.originTo),
      outputTokens: optNumber(record.outputTokens),
      parentSessionKey: optString(record.parentSessionKey),
      runtimeMs: optNumber(record.runtimeMs),
      sessionKey: record.sessionKey,
      sessionUpdatedAt: optNumber(record.sessionUpdatedAt),
      spawnDepth: optNumber(record.spawnDepth),
      startedAt: optNumber(record.startedAt),
      status: record.status,
      subject: optString(record.subject),
      subagentRole: optString(record.subagentRole),
      syncSource: "callback",
      totalTokens: optNumber(record.totalTokens),
      transcriptHash: optString(record.transcriptHash),
      transcriptJsonl: optString(record.transcriptJsonl),
    } satisfies TenantSessionUpsertInput
  })
}

const MAX_TASKS_PER_REQUEST = 2_000
const MAX_RUNS_PER_REQUEST = 500

function validateObjectArray(
  value: unknown,
  label: string,
  maxItems: number,
  required: boolean,
) {
  if (!required && value === undefined) {
    return null
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${label} must be an array`)
  }

  if (value.length > maxItems) {
    throw new ValidationError(
      `${label} array must not exceed ${maxItems} items`,
    )
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ValidationError(`${label}[${index}] must be an object`)
    }

    return entry as Record<string, unknown>
  })
}

function validateScheduledTaskSyncPayload(body: unknown): {
  reason: string | null
  runs: RuntimeCronRun[] | null
  source: string | null
  tasks: RuntimeCronJob[] | null
} {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be an object")
  }

  const record = body as Record<string, unknown>
  const hasTasks = Object.hasOwn(record, "tasks")
  const hasRuns = Object.hasOwn(record, "runs")

  if (!hasTasks && !hasRuns) {
    throw new ValidationError("Request body must include tasks or runs")
  }

  return {
    reason:
      typeof record.reason === "string" && record.reason.trim().length > 0
        ? record.reason
        : null,
    runs: validateObjectArray(
      record.runs,
      "runs",
      MAX_RUNS_PER_REQUEST,
      hasRuns,
    ) as RuntimeCronRun[] | null,
    source:
      typeof record.source === "string" && record.source.trim().length > 0
        ? record.source
        : null,
    tasks: validateObjectArray(
      record.tasks,
      "tasks",
      MAX_TASKS_PER_REQUEST,
      hasTasks,
    ) as RuntimeCronJob[] | null,
  }
}

function handleRuntimeIntegrationError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return jsonNoStore(
        {
          code: "unauthorized",
          message: error.message,
        },
        401,
      )
    }

    return jsonNoStore(
      {
        code: "runtime_integrations_failed",
        message: error.message,
      },
      400,
    )
  }

  return jsonNoStore(
    {
      code: "runtime_integrations_failed",
      message: "Runtime integrations request failed",
    },
    500,
  )
}

function handleSessionSyncError(error: unknown) {
  if (error instanceof ValidationError) {
    return jsonNoStore(
      {
        code: "validation_error",
        message: error.message,
      },
      400,
    )
  }

  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return jsonNoStore(
        {
          code: "unauthorized",
          message: error.message,
        },
        401,
      )
    }

    return jsonNoStore(
      {
        code: "session_sync_failed",
        message: error.message,
      },
      500,
    )
  }

  return jsonNoStore(
    {
      code: "session_sync_failed",
      message: "Session sync failed",
    },
    500,
  )
}

function handleScheduledTaskSyncError(error: unknown) {
  if (error instanceof ValidationError) {
    return jsonNoStore(
      {
        code: "validation_error",
        message: error.message,
      },
      400,
    )
  }

  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return jsonNoStore(
        {
          code: "unauthorized",
          message: error.message,
        },
        401,
      )
    }

    return jsonNoStore(
      {
        code: "scheduled_task_sync_failed",
        message: error.message,
      },
      500,
    )
  }

  return jsonNoStore(
    {
      code: "scheduled_task_sync_failed",
      message: "Scheduled task sync failed",
    },
    500,
  )
}

function describeRuntimeRouteError(error: unknown) {
  return {
    error: error instanceof Error ? error.message : String(error),
    errorName: error instanceof Error ? error.name : null,
  }
}

function handleRuntimeIntegrationSettingsError(error: unknown) {
  if (error instanceof TenantRuntimeConfigVersionConflictError) {
    return jsonNoStore(
      {
        code: "stale_version",
        currentEntryVersion: error.currentVersion,
        message: error.message,
      },
      409,
    )
  }

  if (error instanceof z.ZodError) {
    return jsonNoStore(
      {
        code: "schema_invalid",
        fieldErrors: z.flattenError(error).fieldErrors,
        message: "Invalid runtime integration settings payload",
      },
      400,
    )
  }

  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return jsonNoStore(
        {
          code: "unauthorized",
          message: error.message,
        },
        401,
      )
    }

    return jsonNoStore(
      {
        code: "runtime_integration_settings_failed",
        message: error.message,
      },
      400,
    )
  }

  return jsonNoStore(
    {
      code: "runtime_integration_settings_failed",
      message: "Runtime integration settings request failed",
    },
    500,
  )
}

function handleOpenAiProxyError(error: unknown) {
  if (error instanceof OpenAiProxyError) {
    return jsonNoStore(
      {
        error: error.message,
      },
      error.status,
    )
  }

  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return jsonNoStore(
        {
          error: error.message,
        },
        401,
      )
    }

    return jsonNoStore(
      {
        error: error.message,
      },
      400,
    )
  }

  return jsonNoStore(
    {
      error: "OpenAI proxy request failed",
    },
    500,
  )
}

function handleRuntimeWebSearchError(error: unknown) {
  if (error instanceof RuntimeWebSearchProxyError) {
    return jsonNoStore(
      {
        error: error.message,
      },
      error.status,
    )
  }

  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return jsonNoStore(
        {
          error: error.message,
        },
        401,
      )
    }

    return jsonNoStore(
      {
        error: error.message,
      },
      400,
    )
  }

  return jsonNoStore(
    {
      error: "Managed web search proxy request failed",
    },
    500,
  )
}
