import { jsonNoStore, RuntimeAuthError } from "@otto/auth"
import * as z from "zod"

export * from "./managed-config/agent-personalization-contracts"
export * from "./managed-skills/markdown"
export * from "./managed-skills/system-skills"
export * from "./managed-skills/workspace-contracts"

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

export const MANAGED_SKILL_ENTRY_FILE_PATH = "SKILL.md"

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

export const managedSkillCreateSchema = z
  .object({
    contentText: z.string().optional(),
    description: z.string().trim().min(1).optional(),
    integrationKeys: z.array(z.string().trim().min(1)).optional(),
    skillBody: z.string().optional(),
    skillKey: z.string().trim().min(1),
    skillKeys: z.array(z.string().trim().min(1)).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
  })
  .refine(
    (value) =>
      typeof value.contentText === "string" ||
      typeof value.description === "string" ||
      typeof value.skillBody === "string",
    {
      message:
        "Provide contentText or structured skill fields when creating a managed skill.",
      path: ["contentText"],
    },
  )

export const managedSkillUpdateSchema = z
  .object({
    contentText: z.string().optional(),
    description: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
    integrationKeys: z.array(z.string().trim().min(1)).optional(),
    skillBody: z.string().optional(),
    skillKey: z.string().trim().min(1),
    skillKeys: z.array(z.string().trim().min(1)).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
  })
  .refine(
    (value) =>
      typeof value.contentText === "string" ||
      typeof value.description === "string" ||
      typeof value.skillBody === "string" ||
      Array.isArray(value.integrationKeys) ||
      Array.isArray(value.skillKeys) ||
      typeof value.enabled === "boolean",
    {
      message:
        "Provide at least one managed skill patch field when updating a managed skill.",
      path: ["contentText"],
    },
  )

export const managedSkillDeleteSchema = z.object({
  expectedVersion: z.number().int().positive(),
  skillKey: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(500).optional(),
})

export const managedSkillResetScopeSchema = z.enum(["companion_files"])

export const managedSkillResetSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  scope: managedSkillResetScopeSchema.default("companion_files"),
  skillKey: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(500).optional(),
})

export const managedSkillLibraryInstallSchema = z.object({
  skillKey: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(500).optional(),
})

export async function handleManagedSkillsLibraryGetRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  listTenantManagedSkillLibraryEntriesForTenant: (payload: {
    tenantId: string
  }) => Promise<unknown>
  request: Request
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const librarySkills =
      await input.listTenantManagedSkillLibraryEntriesForTenant({
        tenantId,
      })

    return jsonNoStore({
      librarySkills,
    })
  } catch (error) {
    return handleManagedSkillsRouteError(error, {
      isVersionConflictError: isNeverManagedSkillVersionConflict,
    })
  }
}

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
      fileClass: string
      path: string
      resettable: boolean
      storageEncoding: string
    }>
    version: number
  } | null>
  listTenantManagedSkillsForTenant: (payload: {
    tenantId: string
  }) => Promise<unknown>
  request: Request
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const url = new URL(input.request.url)
    const skillKey = url.searchParams.get("skillKey")?.trim()
    const filePath = url.searchParams.get("filePath")?.trim()

    if (filePath) {
      return jsonNoStore(
        {
          error:
            "filePath is no longer supported on the runtime-managed skills surface. Use get_managed_skill for SKILL.md content and normal file tools for local skill directories.",
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

    const entryFile =
      detail.files.find((file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH) ??
      null

    return jsonNoStore({
      skill: {
        ...detail,
        contentText:
          entryFile?.storageEncoding === "utf8_text" ? entryFile.contentText : null,
        files: detail.files.map((file) => ({
          contentType: file.contentType,
          editability: file.editability,
          fileClass:
            file.fileClass === "managed_entry"
              ? "managed_entry"
              : "managed_seeded",
          path: file.path,
          resettable: file.resettable,
          storageEncoding: file.storageEncoding,
        })),
      },
    })
  } catch (error) {
    return handleManagedSkillsRouteError(error, {
      isVersionConflictError: isNeverManagedSkillVersionConflict,
    })
  }
}

export async function handleManagedSkillsPostRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  createTenantManagedSkillForTenant: (payload: {
    contentText?: string
    createdByExternalId: string | null
    createdByType: "runtime"
    description?: string
    integrationKeys?: string[]
    skillBody?: string
    skillKey: string
    skillKeys?: string[]
    summary: string
    tenantId: string
  }) => Promise<unknown>
  request: Request
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const body = managedSkillCreateSchema.parse(await input.request.json())

    const result = await input.createTenantManagedSkillForTenant({
      ...(typeof body.contentText === "string"
        ? {
            contentText: body.contentText,
          }
        : {}),
      createdByExternalId: null,
      createdByType: "runtime",
      ...(typeof body.description === "string"
        ? {
            description: body.description,
          }
        : {}),
      ...(Array.isArray(body.integrationKeys)
        ? {
            integrationKeys: body.integrationKeys,
          }
        : {}),
      ...(typeof body.skillBody === "string"
        ? {
            skillBody: body.skillBody,
          }
        : {}),
      skillKey: body.skillKey,
      ...(Array.isArray(body.skillKeys)
        ? {
            skillKeys: body.skillKeys,
          }
        : {}),
      summary: body.summary ?? `Runtime created managed skill ${body.skillKey}`,
      tenantId,
    })

    return jsonNoStore(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          error: "Invalid managed skill payload",
          issues: error.issues,
        },
        400,
      )
    }

    return handleManagedSkillsRouteError(error, {
      isVersionConflictError: isNeverManagedSkillVersionConflict,
    })
  }
}

export async function handleManagedSkillsInstallFromLibraryRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  installTenantManagedSkillFromLibraryForTenant: (payload: {
    createdByExternalId: string | null
    createdByType: "runtime"
    skillKey: string
    summary: string
    tenantId: string
  }) => Promise<unknown>
  request: Request
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const body = managedSkillLibraryInstallSchema.parse(await input.request.json())
    const result = await input.installTenantManagedSkillFromLibraryForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      skillKey: body.skillKey,
      summary:
        body.summary ??
        `Runtime installed managed skill from the library: ${body.skillKey}`,
      tenantId,
    })

    return jsonNoStore(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          error: "Invalid managed skill library install payload",
          issues: error.issues,
        },
        400,
      )
    }

    return handleManagedSkillsRouteError(error, {
      isVersionConflictError: isNeverManagedSkillVersionConflict,
    })
  }
}

export async function handleManagedSkillsUpdateRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  isVersionConflictError: (
    error: unknown,
  ) => error is ManagedSkillVersionConflictLike
  request: Request
  updateTenantManagedSkillForTenant: (payload: {
    createdByExternalId: string | null
    createdByType: "runtime"
    expectedVersion?: number
    patch: {
      contentText?: string
      description?: string
      enabled?: boolean
      integrationKeys?: string[]
      skillBody?: string
      skillKeys?: string[]
    }
    skillKey: string
    summary: string
    tenantId: string
  }) => Promise<unknown>
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const body = managedSkillUpdateSchema.parse(await input.request.json())

    const patch = {
      ...(typeof body.contentText === "string"
        ? {
            contentText: body.contentText,
          }
        : {}),
      ...(typeof body.description === "string"
        ? {
            description: body.description,
          }
        : {}),
      ...(typeof body.enabled === "boolean"
        ? {
            enabled: body.enabled,
          }
        : {}),
      ...(Array.isArray(body.integrationKeys)
        ? {
            integrationKeys: body.integrationKeys,
          }
        : {}),
      ...(typeof body.skillBody === "string"
        ? {
            skillBody: body.skillBody,
          }
        : {}),
      ...(Array.isArray(body.skillKeys)
        ? {
            skillKeys: body.skillKeys,
          }
        : {}),
    }

    const result = await input.updateTenantManagedSkillForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      patch,
      skillKey: body.skillKey,
      summary: body.summary ?? `Runtime updated managed skill ${body.skillKey}`,
      tenantId,
    })

    return jsonNoStore(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          error: "Invalid managed skill payload",
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

export async function handleManagedSkillsDeleteRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  deleteTenantManagedSkillForTenant: (payload: {
    createdByExternalId: string | null
    createdByType: "runtime"
    expectedVersion: number
    skillKey: string
    summary: string
    tenantId: string
  }) => Promise<unknown>
  isVersionConflictError: (
    error: unknown,
  ) => error is ManagedSkillVersionConflictLike
  request: Request
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const body = managedSkillDeleteSchema.parse(await input.request.json())
    const result = await input.deleteTenantManagedSkillForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      skillKey: body.skillKey,
      summary: body.summary ?? `Runtime deleted managed skill ${body.skillKey}`,
      tenantId,
    })

    return jsonNoStore(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          error: "Invalid managed skill payload",
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

export async function handleManagedSkillsResetRequest(input: {
  authenticateTenantRuntimeRequest: (
    request: Request,
  ) => Promise<{ tenantId: string }>
  isVersionConflictError: (
    error: unknown,
  ) => error is ManagedSkillVersionConflictLike
  request: Request
  resetTenantManagedSkillPackageForTenant: (payload: {
    createdByExternalId: string | null
    createdByType: "runtime"
    expectedVersion?: number
    scope: "companion_files"
    skillKey: string
    summary: string
    tenantId: string
  }) => Promise<unknown>
}) {
  try {
    const { tenantId } = await input.authenticateTenantRuntimeRequest(
      input.request,
    )
    const body = managedSkillResetSchema.parse(await input.request.json())

    const result = await input.resetTenantManagedSkillPackageForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      scope: body.scope,
      skillKey: body.skillKey,
      summary:
        body.summary ??
        `Runtime reset managed skill package ${body.skillKey}`,
      tenantId,
    })

    return jsonNoStore(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          error: "Invalid managed skill payload",
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
