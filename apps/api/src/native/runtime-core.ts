import { authenticateTenantRuntimeRequest as authenticateTenantRuntimeRequestWithPackage } from "@otto/auth"
import {
  handleManagedConfigGetRequest,
  handleManagedConfigPatchRequest,
  handleManagedSkillsGetRequest,
  handleManagedSkillsPatchRequest,
  type ManagedConfigVersionConflictLike,
  type ManagedSkillVersionConflictLike,
} from "@otto/feature-runtime-core"
import type { Hono } from "hono"

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
