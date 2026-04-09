import { jsonNoStore } from "@otto/auth"
import { isReservedWorkspaceSlug } from "@otto/feature-workspace-slugs"
import * as z from "zod"

const DEFAULT_LOCALE = "en-US"
const DEFAULT_TIME_FORMAT_PREFERENCE = "auto"
const DEFAULT_TIME_ZONE = "UTC"

function normalizeLocale(locale?: string | null) {
  if (!locale) {
    return DEFAULT_LOCALE
  }

  try {
    const [canonicalLocale] = Intl.getCanonicalLocales(locale)

    return canonicalLocale ?? DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

function isSupportedLocale(locale: string) {
  return normalizeLocale(locale) === locale
}

function normalizeTimeZone(timeZone?: string | null) {
  if (!timeZone) {
    return DEFAULT_TIME_ZONE
  }

  try {
    new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      timeZone,
    }).format(new Date())

    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

function isSupportedTimeZone(timeZone: string) {
  return normalizeTimeZone(timeZone) === timeZone
}

function normalizeTimeFormatPreference(value?: string | null) {
  if (value === "12" || value === "24" || value === "auto") {
    return value
  }

  return DEFAULT_TIME_FORMAT_PREFERENCE
}

export const workspaceSummarySchema = z.object({
  id: z.string(),
  isReady: z.boolean(),
  locale: z.string(),
  name: z.string(),
  slug: z.string(),
  timeFormatPreference: z.string(),
  timezone: z.string(),
})

export const shellBootstrapSchema = z.object({
  currentOrganization: workspaceSummarySchema,
  organizations: z.array(workspaceSummarySchema),
  user: z.object({
    email: z.string(),
    id: z.string(),
    isPlatformAdmin: z.boolean(),
    name: z.string(),
  }),
})

export const usageTimeSeriesEntrySchema = z.object({
  bucketStart: z.string().optional().nullable(),
  inputTokens: z.number().optional().nullable(),
  outputTokens: z.number().optional().nullable(),
  requests: z.number().optional().nullable(),
})

export const usageByModelEntrySchema = z.object({
  creditsBurnedMilli: z.number().optional().nullable(),
  inputTokens: z.number().optional().nullable(),
  model: z.string(),
  outputTokens: z.number().optional().nullable(),
  provider: z.string().optional().nullable(),
  requests: z.number().optional().nullable(),
})

export const usageOverviewSchema = z.object({
  summary: z.object({
    activeApiKeys: z.number(),
    activeModels: z.number(),
    totalCreditsBurnedMilli: z.number(),
    totalInputTokens: z.number(),
    totalOutputTokens: z.number(),
    totalProviderCostMicros: z.number(),
    totalRequests: z.number(),
  }),
  timeSeries: z.array(usageTimeSeriesEntrySchema),
  usageByModel: z.array(usageByModelEntrySchema),
  usageByType: z.array(z.record(z.string(), z.unknown())),
})

const updateNameSchema = z.object({
  action: z.literal("update-name"),
  name: z.string().trim().min(1, "Name is required"),
})

const updateSlugSchema = z.object({
  action: z.literal("update-slug"),
  slug: z
    .string()
    .trim()
    .min(1, "URL is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "URL must be lowercase letters, numbers, and hyphens",
    ),
})

const updateTimezoneSchema = z.object({
  action: z.literal("update-timezone"),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .refine(
      (value) => isSupportedTimeZone(value),
      "Timezone must be a valid IANA timezone",
    ),
})

const updateLocaleSchema = z.object({
  action: z.literal("update-locale"),
  locale: z
    .string()
    .trim()
    .min(1, "Locale is required")
    .refine(
      (value) => isSupportedLocale(value),
      "Locale must be a valid BCP 47 locale",
    ),
})

const updateTimeFormatSchema = z.object({
  action: z.literal("update-time-format"),
  timeFormatPreference: z
    .string()
    .trim()
    .refine(
      (value) => normalizeTimeFormatPreference(value) === value,
      "Time format must be auto, 12, or 24",
    ),
})

export const workspaceSettingsUpdateSchema = z.discriminatedUnion("action", [
  updateNameSchema,
  updateSlugSchema,
  updateLocaleSchema,
  updateTimeFormatSchema,
  updateTimezoneSchema,
])

export const workspaceSettingsSuccessSchema = z.union([
  z.object({
    name: z.string(),
  }),
  z.object({
    slug: z.string(),
  }),
  z.object({
    applyQueued: z.boolean(),
    locale: z.string(),
    timeFormatPreference: z.string(),
    timezone: z.string(),
  }),
])

export const usageSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export type WorkspaceShellUser = {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>
export type WorkspaceUsageOverview = z.infer<typeof usageOverviewSchema>
export type WorkspaceSettingsUpdate = z.infer<
  typeof workspaceSettingsUpdateSchema
>
export type WorkspaceSettingsSuccess = z.infer<
  typeof workspaceSettingsSuccessSchema
>

function getEmptyUsageOverview(): WorkspaceUsageOverview {
  return usageOverviewSchema.parse({
    summary: {
      activeApiKeys: 0,
      activeModels: 0,
      totalCreditsBurnedMilli: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalProviderCostMicros: 0,
      totalRequests: 0,
    },
    timeSeries: [],
    usageByModel: [],
    usageByType: [],
  })
}

export async function handleWorkspaceBootstrapRequest<
  TUser extends WorkspaceShellUser,
>(input: {
  getCurrentWorkspace?: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceSummary | null>
  getDashboardOrganizations: (
    userExternalId: string,
  ) => Promise<WorkspaceSummary[]>
  hasPlatformAdminRole: (userExternalId: string) => Promise<boolean>
  orgSlug: string
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  const userName =
    [input.user.firstName, input.user.lastName].filter(Boolean).join(" ") ||
    input.user.email

  let organizations: WorkspaceSummary[] = []
  let isPlatformAdmin = false
  let bootstrapError: unknown = null

  try {
    await input.syncUserFromSession(input.user)
  } catch (error) {
    bootstrapError = error
  }

  const [organizationsResult, isPlatformAdminResult] = await Promise.allSettled(
    [
      input.getDashboardOrganizations(input.user.id),
      input.hasPlatformAdminRole(input.user.id),
    ],
  )

  if (organizationsResult.status === "fulfilled") {
    organizations = organizationsResult.value
  } else if (!bootstrapError) {
    bootstrapError = organizationsResult.reason
  }

  if (isPlatformAdminResult.status === "fulfilled") {
    isPlatformAdmin = isPlatformAdminResult.value
  }

  let currentOrganization =
    organizations.find((organization) => organization.slug === input.orgSlug) ??
    null

  if (!currentOrganization && input.getCurrentWorkspace) {
    try {
      currentOrganization = await input.getCurrentWorkspace({
        orgSlug: input.orgSlug,
        userExternalId: input.user.id,
      })
    } catch (error) {
      if (!bootstrapError) {
        bootstrapError = error
      }
    }
  }

  if (!currentOrganization) {
    if (bootstrapError) {
      return jsonNoStore(
        {
          code: "bootstrap_failed",
          message:
            bootstrapError instanceof Error
              ? bootstrapError.message
              : "Failed to load workspace.",
        },
        400,
      )
    }

    return jsonNoStore(
      {
        code: "organization_not_found",
        message: "Organization not found.",
      },
      404,
    )
  }

  if (
    !organizations.some((organization) => organization.slug === input.orgSlug)
  ) {
    organizations = [currentOrganization, ...organizations]
  }

  return jsonNoStore(
    shellBootstrapSchema.parse({
      currentOrganization,
      organizations,
      user: {
        email: input.user.email,
        id: input.user.id,
        isPlatformAdmin,
        name: userName,
      },
    }),
  )
}

export async function handleWorkspaceUsageRequest<
  TUser extends WorkspaceShellUser,
>(input: {
  getOrganizationTenantForBilling: (organizationId: string) => Promise<{
    id: string
  } | null>
  getOrganizationWorkspaceBySlug: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<{ id: string }>
  getTenantProviderUsageOverview: (payload: {
    from: Date
    tenantId: string
    to: Date
  }) => Promise<WorkspaceUsageOverview>
  orgSlug: string
  request: Request
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)
    const url = new URL(input.request.url)
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")

    if (!fromParam || !toParam) {
      return jsonNoStore(
        { code: "bad_request", message: "Missing from/to params" },
        400,
      )
    }

    const from = new Date(fromParam)
    const to = new Date(toParam)

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return jsonNoStore(
        { code: "bad_request", message: "Invalid from/to dates" },
        400,
      )
    }

    if (from > to) {
      return jsonNoStore(
        {
          code: "bad_request",
          message: "The start date must be before the end date.",
        },
        400,
      )
    }

    const organization = await input.getOrganizationWorkspaceBySlug({
      orgSlug: input.orgSlug,
      userExternalId: input.user.id,
    })
    const tenant = await input.getOrganizationTenantForBilling(organization.id)

    if (!tenant) {
      return jsonNoStore(getEmptyUsageOverview())
    }

    const overview = await input.getTenantProviderUsageOverview({
      from,
      tenantId: tenant.id,
      to,
    })

    return jsonNoStore(usageOverviewSchema.parse(overview))
  } catch (error) {
    return jsonNoStore(
      {
        code: "usage_fetch_failed",
        message: error instanceof Error ? error.message : "Usage fetch failed.",
      },
      500,
    )
  }
}

export async function handleWorkspaceSettingsUpdateRequest<
  TUser extends WorkspaceShellUser,
>(input: {
  getOrganizationWorkspaceBySlug: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<{ externalId: string; id: string }>
  orgSlug: string
  renameOrganization: (payload: {
    externalOrganizationId: string
    name: string
    organizationId: string
  }) => Promise<void>
  request: Request
  syncUserFromSession: (user: TUser) => Promise<unknown>
  updateOrganizationSlug: (payload: {
    organizationId: string
    slug: string
  }) => Promise<"ok" | "slug_taken">
  updateWorkspaceDateTimePreferences: (payload: {
    organizationId: string
    locale?: string
    timeFormatPreference?: string
    timezone?: string
  }) => Promise<{
    applyQueued: boolean
    locale: string
    timeFormatPreference: string
    timezone: string
  }>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)
    const body = workspaceSettingsUpdateSchema.parse(await input.request.json())
    const organization = await input.getOrganizationWorkspaceBySlug({
      orgSlug: input.orgSlug,
      userExternalId: input.user.id,
    })

    if (body.action === "update-name") {
      await input.renameOrganization({
        externalOrganizationId: organization.externalId,
        name: body.name,
        organizationId: organization.id,
      })

      return jsonNoStore(
        workspaceSettingsSuccessSchema.parse({ name: body.name }),
      )
    }

    if (body.action === "update-slug") {
      if (isReservedWorkspaceSlug(body.slug)) {
        return jsonNoStore(
          { code: "slug_reserved", message: "This URL is reserved" },
          409,
        )
      }

      const result = await input.updateOrganizationSlug({
        organizationId: organization.id,
        slug: body.slug,
      })

      if (result === "slug_taken") {
        return jsonNoStore(
          { code: "slug_taken", message: "This URL is already in use" },
          409,
        )
      }

      return jsonNoStore(
        workspaceSettingsSuccessSchema.parse({ slug: body.slug }),
      )
    }

    const result = await input.updateWorkspaceDateTimePreferences(
      body.action === "update-timezone"
        ? {
            organizationId: organization.id,
            timezone: body.timezone,
          }
        : body.action === "update-locale"
          ? {
              locale: body.locale,
              organizationId: organization.id,
            }
          : {
              organizationId: organization.id,
              timeFormatPreference: body.timeFormatPreference,
            },
    )

    return jsonNoStore(workspaceSettingsSuccessSchema.parse(result))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid payload",
        },
        400,
      )
    }

    return jsonNoStore(
      {
        code: "update_failed",
        message: error instanceof Error ? error.message : "Update failed",
      },
      400,
    )
  }
}
