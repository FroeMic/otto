import { jsonNoStore, RuntimeAuthError } from "@otto/auth"
import * as z from "zod"

export type ManagedConfigVersionConflictLike = {
  currentVersion: number
  expectedVersion?: number
  message: string
}

export type ManagedSkillVersionConflictLike = {
  currentVersion: number
  expectedVersion?: number
  message: string
}

function isNeverManagedConfigVersionConflict(
  _error: unknown,
): _error is ManagedConfigVersionConflictLike {
  return false
}

function isNeverManagedSkillVersionConflict(
  _error: unknown,
): _error is ManagedSkillVersionConflictLike {
  return false
}

export const managedConfigPatchSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  filePath: z.string(),
  sharedContent: z.string(),
  summary: z.string().trim().min(1).max(500).optional(),
})

export async function handleManagedConfigGetRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  getLatestTenantManagedConfig: (tenantId: string) => Promise<{
    files: Array<{ path: string }>
    version: number
  }>
  normalizeManagedBootstrapFilePath: (filePath: string) => string | null
  request: Request
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const managedConfig = await input.getLatestTenantManagedConfig(tenantId)
    const url = new URL(input.request.url)
    const filePath = url.searchParams.get("filePath")

    if (filePath) {
      const normalizedFilePath =
        input.normalizeManagedBootstrapFilePath(filePath)

      if (!normalizedFilePath) {
        return jsonNoStore(
          {
            error: `Unsupported managed config file: ${filePath}`,
          },
          400,
        )
      }

      const file = managedConfig.files.find(
        (entry) => entry.path === normalizedFilePath,
      )

      if (!file) {
        return jsonNoStore(
          {
            error: `Managed config file not found: ${filePath}`,
          },
          404,
        )
      }

      return jsonNoStore({
        file,
        version: managedConfig.version,
      })
    }

    return jsonNoStore({
      files: managedConfig.files,
      version: managedConfig.version,
    })
  } catch (error) {
    return handleManagedConfigRouteError(error, {
      isVersionConflictError: isNeverManagedConfigVersionConflict,
    })
  }
}

export async function handleManagedConfigPatchRequest<
  TFilePath extends string,
>(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  isVersionConflictError: (
    error: unknown,
  ) => error is ManagedConfigVersionConflictLike
  normalizeManagedBootstrapFilePath: (filePath: string) => TFilePath | null
  request: Request
  updateTenantManagedFileSharedContentForTenant: (payload: {
    createdByExternalId: string | null
    createdByType: "runtime"
    expectedVersion?: number
    filePath: TFilePath
    sharedContent: string
    summary: string
    tenantId: string
  }) => Promise<unknown>
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const body = managedConfigPatchSchema.parse(await input.request.json())
    const normalizedFilePath = input.normalizeManagedBootstrapFilePath(
      body.filePath,
    )

    if (!normalizedFilePath) {
      return jsonNoStore(
        {
          error: `Unsupported managed config file: ${body.filePath}`,
        },
        400,
      )
    }

    const result = await input.updateTenantManagedFileSharedContentForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      filePath: normalizedFilePath,
      sharedContent: body.sharedContent,
      summary:
        body.summary ??
        `Runtime updated shared managed config block for ${body.filePath}`,
      tenantId,
    })

    return jsonNoStore(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          error: "Invalid managed config payload",
          issues: error.issues,
        },
        400,
      )
    }

    return handleManagedConfigRouteError(error, {
      isVersionConflictError: input.isVersionConflictError,
    })
  }
}

function handleManagedConfigRouteError(
  error: unknown,
  input: {
    isVersionConflictError: (
      error: unknown,
    ) => error is ManagedConfigVersionConflictLike
  },
) {
  if (input.isVersionConflictError(error)) {
    return jsonNoStore(
      {
        currentVersion: error.currentVersion,
        error: error.message,
        expectedVersion: error.expectedVersion,
      },
      409,
    )
  }

  if (error instanceof RuntimeAuthError) {
    return jsonNoStore(
      {
        error: error.message,
      },
      error.status,
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
      error: "Managed config request failed",
    },
    500,
  )
}

export const managedSkillPatchSchema = z.object({
  contentText: z.string(),
  expectedVersion: z.number().int().positive().optional(),
  filePath: z.string().trim().min(1),
  skillKey: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(500).optional(),
})

export async function handleManagedSkillsGetRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  getLatestTenantManagedSkillDetailForTenant: (payload: {
    skillKey: string
    tenantId: string
  }) => Promise<{
    files: Array<{
      contentText: string | null
      contentType: string | null
      editability: string
      path: string
      storageEncoding: string
    }>
    version: number
  } | null>
  listTenantManagedSkillsForTenant: (payload: {
    tenantId: string
  }) => Promise<unknown>
  managedSkillEntryFilePath: string
  request: Request
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const url = new URL(input.request.url)
    const skillKey = url.searchParams.get("skillKey")?.trim()
    const filePath = url.searchParams.get("filePath")?.trim()

    if (filePath && !skillKey) {
      return jsonNoStore(
        {
          error: "filePath requires skillKey.",
        },
        400,
      )
    }

    if (filePath && filePath !== input.managedSkillEntryFilePath) {
      return jsonNoStore(
        {
          error:
            "Only SKILL.md can be read through the runtime-managed skills surface.",
        },
        400,
      )
    }

    if (!skillKey) {
      const skills = await input.listTenantManagedSkillsForTenant({
        tenantId,
      })

      return jsonNoStore({
        skills,
      })
    }

    const detail = await input.getLatestTenantManagedSkillDetailForTenant({
      skillKey,
      tenantId,
    })

    if (!detail) {
      return jsonNoStore(
        {
          error: `Managed skill not found: ${skillKey}`,
        },
        404,
      )
    }

    if (!filePath) {
      return jsonNoStore({
        skill: {
          ...detail,
          files: detail.files.map((file) => ({
            contentType: file.contentType,
            editability: file.editability,
            path: file.path,
            storageEncoding: file.storageEncoding,
          })),
        },
      })
    }

    const file = detail.files.find((entry) => entry.path === filePath)

    if (!file) {
      return jsonNoStore(
        {
          error: `Managed skill file not found: ${skillKey}/${filePath}`,
        },
        404,
      )
    }

    if (file.editability === "local_state") {
      return jsonNoStore(
        {
          error:
            "state/ files are not exposed through the runtime-managed skills surface in this slice.",
        },
        400,
      )
    }

    if (file.storageEncoding !== "utf8_text" || file.contentText === null) {
      return jsonNoStore(
        {
          error:
            "Only managed UTF-8 text files can be read through the runtime-managed skills surface in this slice.",
        },
        400,
      )
    }

    return jsonNoStore({
      file: {
        contentText: file.contentText,
        contentType: file.contentType,
        editability: file.editability,
        path: file.path,
        storageEncoding: file.storageEncoding,
      },
      version: detail.version,
    })
  } catch (error) {
    return handleManagedSkillsRouteError(error, {
      isVersionConflictError: isNeverManagedSkillVersionConflict,
    })
  }
}

export async function handleManagedSkillsPatchRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  isVersionConflictError: (
    error: unknown,
  ) => error is ManagedSkillVersionConflictLike
  managedSkillEntryFilePath: string
  request: Request
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
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const body = managedSkillPatchSchema.parse(await input.request.json())

    if (body.filePath !== input.managedSkillEntryFilePath) {
      return jsonNoStore(
        {
          error:
            "Only SKILL.md can be patched through the runtime-managed skills surface.",
        },
        400,
      )
    }

    const result = await input.updateTenantManagedSkillTextFileForTenant({
      contentText: body.contentText,
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      relativePath: body.filePath,
      skillKey: body.skillKey,
      summary:
        body.summary ??
        `Runtime updated managed skill file ${body.skillKey}/${body.filePath}`,
      tenantId,
    })

    return jsonNoStore(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          error: "Invalid managed skills payload",
          issues: error.issues,
        },
        400,
      )
    }

    return handleManagedSkillsRouteError(error, {
      isVersionConflictError: input.isVersionConflictError,
    })
  }
}

function handleManagedSkillsRouteError(
  error: unknown,
  input: {
    isVersionConflictError: (
      error: unknown,
    ) => error is ManagedSkillVersionConflictLike
  },
) {
  if (input.isVersionConflictError(error)) {
    return jsonNoStore(
      {
        currentVersion: error.currentVersion,
        error: error.message,
        expectedVersion: error.expectedVersion,
      },
      409,
    )
  }

  if (error instanceof RuntimeAuthError) {
    return jsonNoStore(
      {
        error: error.message,
      },
      error.status,
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
      error: "Managed skills request failed",
    },
    500,
  )
}
