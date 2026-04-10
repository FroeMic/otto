import {
  authenticateTenantRuntimeRequest as authenticateTenantRuntimeRequestWithPackage,
  jsonNoStore,
} from "@otto/auth"
import {
  handleManagedConfigGetRequest,
  handleManagedConfigPatchRequest,
  handleManagedSkillsGetRequest,
  handleManagedSkillsPatchRequest,
  type ManagedConfigVersionConflictLike,
  type ManagedSkillVersionConflictLike,
} from "@otto/feature-runtime-core"
import type { Hono } from "hono"
import { z } from "zod"

import {
  findRuntimeIntegrationCommandsForTenant,
  getRuntimeIntegrationConnectionActionForTenant,
  getRuntimeIntegrationDetailsForTenant,
  getRuntimeIntegrationForTenant,
  getRuntimeIntegrationSettingsForTenant,
  listRuntimeIntegrationsForTenant,
} from "../runtime/integrations"
import {
  OpenAiProxyError,
  proxyOpenAiAudioTranscriptionsRequest,
  proxyOpenAiResponsesRequest,
} from "../runtime/openai-proxy"
import {
  proxyRuntimeWebSearchRequest,
  RuntimeWebSearchProxyError,
} from "../runtime/web-search"

const controlPlaneModulePath = "../../../../web/src/db/control-plane"
const managedSkillsModulePath = "../../../../web/src/db/managed-skills"
const managedSkillPackageModulePath =
  "../../../../web/src/lib/managed-skills/package"
const managedConfigModulePath =
  "../../../../web/src/lib/openclaw/managed-config"

type TenantLookupResult = {
  tenantId: string
}

async function authenticateTenantRuntimeRequest(request: Request) {
  const controlPlaneModule = (await import(controlPlaneModulePath)) as {
    getTenantByTenantToken: (
      tenantToken: string,
    ) => Promise<TenantLookupResult | null>
  }

  return authenticateTenantRuntimeRequestWithPackage({
    getTenantByTenantToken: controlPlaneModule.getTenantByTenantToken,
    log: (message) => {
      console.log(message)
    },
    request,
    resolveTenantId: (tenant) => tenant.tenantId,
  })
}

export function registerRuntimeCoreRoutes(app: Hono) {
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

        const connectionAction =
          await getRuntimeIntegrationConnectionActionForTenant({
            action,
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

  app.post("/api/internal/runtime/ai/openai/v1/responses", async (context) => {
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
    const [controlPlaneModule, managedConfigModule] = await Promise.all([
      import(controlPlaneModulePath),
      import(managedConfigModulePath),
    ])

    return handleManagedConfigGetRequest({
      authenticateTenantRuntimeRequest,
      getLatestTenantManagedConfig: (
        controlPlaneModule as {
          getLatestTenantManagedConfig: (tenantId: string) => Promise<{
            files: Array<{ path: string }>
            version: number
          }>
        }
      ).getLatestTenantManagedConfig,
      normalizeManagedBootstrapFilePath: (
        managedConfigModule as {
          normalizeManagedBootstrapFilePath: (filePath: string) => string | null
        }
      ).normalizeManagedBootstrapFilePath,
      request: context.req.raw,
    })
  })

  app.patch("/api/internal/runtime/managed-config", async (context) => {
    const [controlPlaneModule, managedConfigModule] = await Promise.all([
      import(controlPlaneModulePath),
      import(managedConfigModulePath),
    ])
    const controlPlane = controlPlaneModule as {
      ManagedConfigVersionConflictError: new (
        ...args: never[]
      ) => ManagedConfigVersionConflictLike
      updateTenantManagedFileSharedContentForTenant: (payload: {
        createdByExternalId: string | null
        createdByType: "runtime"
        expectedVersion?: number
        filePath: string
        sharedContent: string
        summary: string
        tenantId: string
      }) => Promise<unknown>
    }

    return handleManagedConfigPatchRequest({
      authenticateTenantRuntimeRequest,
      isVersionConflictError: (
        error,
      ): error is ManagedConfigVersionConflictLike =>
        error instanceof controlPlane.ManagedConfigVersionConflictError,
      normalizeManagedBootstrapFilePath: (
        managedConfigModule as {
          normalizeManagedBootstrapFilePath: (filePath: string) => string | null
        }
      ).normalizeManagedBootstrapFilePath,
      request: context.req.raw,
      updateTenantManagedFileSharedContentForTenant:
        controlPlane.updateTenantManagedFileSharedContentForTenant,
    })
  })

  app.get("/api/internal/runtime/managed-skills", async (context) => {
    const [managedSkillsModule, managedSkillPackageModule] = await Promise.all([
      import(managedSkillsModulePath),
      import(managedSkillPackageModulePath),
    ])

    return handleManagedSkillsGetRequest({
      authenticateTenantRuntimeRequest,
      getLatestTenantManagedSkillDetailForTenant: (
        managedSkillsModule as {
          getLatestTenantManagedSkillDetailForTenant: (payload: {
            skillKey: string
            tenantId: string
          }) => Promise<{
            files: Array<{
              contentText: string | null
              contentType: string
              editability: string
              path: string
              storageEncoding: string
            }>
            version: number
          } | null>
        }
      ).getLatestTenantManagedSkillDetailForTenant,
      listTenantManagedSkillsForTenant: (
        managedSkillsModule as {
          listTenantManagedSkillsForTenant: (payload: {
            tenantId: string
          }) => Promise<unknown>
        }
      ).listTenantManagedSkillsForTenant,
      managedSkillEntryFilePath: (
        managedSkillPackageModule as {
          MANAGED_SKILL_ENTRY_FILE_PATH: string
        }
      ).MANAGED_SKILL_ENTRY_FILE_PATH,
      request: context.req.raw,
    })
  })

  app.patch("/api/internal/runtime/managed-skills", async (context) => {
    const [controlPlaneModule, managedSkillsModule, managedSkillPackageModule] =
      await Promise.all([
        import(controlPlaneModulePath),
        import(managedSkillsModulePath),
        import(managedSkillPackageModulePath),
      ])
    const controlPlane = controlPlaneModule as {
      updateTenantManagedSkillTextFileForTenant: (payload: {
        contentText: string
        createdByExternalId: string | null
        createdByType: "runtime"
        expectedVersion?: number
        relativePath: string
        skillKey: string
        summary: string
        tenantId: string
      }) => Promise<unknown>
    }
    const managedSkills = managedSkillsModule as {
      ManagedSkillVersionConflictError: new (
        ...args: never[]
      ) => ManagedSkillVersionConflictLike
    }

    return handleManagedSkillsPatchRequest({
      authenticateTenantRuntimeRequest,
      isVersionConflictError: (
        error,
      ): error is ManagedSkillVersionConflictLike =>
        error instanceof managedSkills.ManagedSkillVersionConflictError,
      managedSkillEntryFilePath: (
        managedSkillPackageModule as {
          MANAGED_SKILL_ENTRY_FILE_PATH: string
        }
      ).MANAGED_SKILL_ENTRY_FILE_PATH,
      request: context.req.raw,
      updateTenantManagedSkillTextFileForTenant:
        controlPlane.updateTenantManagedSkillTextFileForTenant,
    })
  })
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

function handleRuntimeIntegrationSettingsError(error: unknown) {
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
