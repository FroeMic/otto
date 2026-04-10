import * as z from "zod"

import {
  isSupportedLocale,
  isSupportedTimeZone,
  normalizeTimeFormatPreference,
} from "./normalization"

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

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>
export type WorkspaceUsageOverview = z.infer<typeof usageOverviewSchema>
export type WorkspaceSettingsUpdate = z.infer<
  typeof workspaceSettingsUpdateSchema
>
export type WorkspaceSettingsSuccess = z.infer<
  typeof workspaceSettingsSuccessSchema
>
