import { z } from "zod"

function createJsonDateSchema() {
  return z.union([z.date(), z.string()]).transform((value) => {
    return value instanceof Date ? value.toISOString() : value
  })
}

const jsonDateSchema = createJsonDateSchema()

export const platformOrganizationOptionSchema = z.object({
  name: z.string(),
  slug: z.string(),
})

export const platformBootstrapSchema = z.object({
  organizations: z.array(platformOrganizationOptionSchema),
  user: z.object({
    email: z.string(),
    id: z.string(),
    isPlatformAdmin: z.boolean(),
    name: z.string(),
  }),
})

export const platformSlackIntegrationSchema = z.object({
  connectedAt: jsonDateSchema.nullable(),
  lastError: z.string().nullable(),
  lastErrorAt: jsonDateSchema.nullable(),
  status: z.string(),
  teamId: z.string().nullable(),
  teamName: z.string().nullable(),
})

export const platformApplyRunSummarySchema = z.object({
  desiredStateVersion: z.number(),
  error: z.string().nullable(),
  finishedAt: jsonDateSchema.nullable(),
  startedAt: jsonDateSchema.nullable(),
  status: z.string(),
})

export const platformJobEventSummarySchema = z.object({
  createdAt: jsonDateSchema,
  eventType: z.string(),
  message: z.string(),
})

export const platformLatestJobSummarySchema = z.object({
  attempt: z.number(),
  createdAt: jsonDateSchema,
  error: z.string().nullable(),
  events: z.array(platformJobEventSummarySchema),
  finishedAt: jsonDateSchema.nullable(),
  id: z.string(),
  jobType: z.string(),
  startedAt: jsonDateSchema.nullable(),
  status: z.string(),
  step: z.string().nullable(),
})

export const platformTenantSummarySchema = z.object({
  id: z.string(),
  ipv4: z.string().nullable(),
  latestApplyRun: platformApplyRunSummarySchema.nullable(),
  latestJob: platformLatestJobSummarySchema.nullable(),
  name: z.string(),
  provisioningStrategy: z.string().nullable(),
  serverStatus: z.string().nullable(),
  sourceImage: z.string().nullable(),
  status: z.string(),
})

export const platformOrganizationListItemSchema = z.object({
  configuredRuntimeImage: z.string().nullable(),
  configuredRuntimeImageVersion: z.string().nullable(),
  id: z.string(),
  isReady: z.boolean(),
  locale: z.string(),
  name: z.string(),
  observedRuntimeImage: z.string().nullable(),
  observedRuntimeImageVersion: z.string().nullable(),
  slackIntegration: platformSlackIntegrationSchema.nullable(),
  slug: z.string(),
  tenant: platformTenantSummarySchema.nullable(),
  timeFormatPreference: z.string(),
  timezone: z.string(),
})

export const platformOrganizationsResponseSchema = z.object({
  organizations: z.array(platformOrganizationListItemSchema),
})

export const platformCreateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
})

export const platformCreateOrganizationResponseSchema = z.object({
  organization: platformOrganizationListItemSchema,
})

export const platformAddCurrentUserAdminResponseSchema = z.object({
  membership: z.object({
    id: z.string(),
    organizationId: z.string(),
    organizationSlug: z.string(),
    role: z.string(),
    status: z.string(),
  }),
})

export const platformOpenAiProviderSummarySchema = z.object({
  activeApiKeyId: z.string().nullable(),
  activeCredentialCount: z.number(),
  activeServiceAccountId: z.string().nullable(),
  latestCredentialCreatedAt: jsonDateSchema.nullable(),
  projectId: z.string().nullable(),
  status: z.string(),
  totalCredentialCount: z.number(),
})

export const platformApplyRunDetailSchema = z.object({
  createdAt: jsonDateSchema,
  desiredStateVersion: z.number(),
  error: z.string().nullable(),
  finishedAt: jsonDateSchema.nullable(),
  id: z.string(),
  restartStderr: z.string().nullable(),
  restartStdout: z.string().nullable(),
  startedAt: jsonDateSchema.nullable(),
  status: z.string(),
  verifyStderr: z.string().nullable(),
  verifyStdout: z.string().nullable(),
})

export const platformJobResultSchema = z
  .object({
    host: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    restartStderr: z.string().nullable().optional(),
    restartStdout: z.string().nullable().optional(),
    verifyStderr: z.string().nullable().optional(),
    verifyStdout: z.string().nullable().optional(),
  })
  .passthrough()

export const platformJobDetailSchema = z.object({
  attempt: z.number(),
  createdAt: jsonDateSchema,
  error: z.string().nullable(),
  events: z.array(platformJobEventSummarySchema),
  finishedAt: jsonDateSchema.nullable(),
  id: z.string(),
  jobType: z.string(),
  result: platformJobResultSchema.nullable(),
  startedAt: jsonDateSchema.nullable(),
  status: z.string(),
  step: z.string().nullable(),
})

export const platformEventDetailSchema = z.object({
  createdAt: jsonDateSchema,
  eventType: z.string(),
  id: z.string(),
  jobRunId: z.string(),
  jobStatus: z.string(),
  jobType: z.string(),
  message: z.string(),
  step: z.string().nullable(),
})

export const platformTenantDetailSchema = z.object({
  id: z.string(),
  ipv4: z.string().nullable(),
  latestDesiredStateVersion: z.number().nullable(),
  latestApplyRun: platformApplyRunSummarySchema.nullable(),
  latestJob: platformLatestJobSummarySchema.nullable(),
  name: z.string(),
  openAiProvider: platformOpenAiProviderSummarySchema.nullable(),
  provisioningStrategy: z.string().nullable(),
  recentApplyRuns: z.array(platformApplyRunDetailSchema),
  recentEvents: z.array(platformEventDetailSchema),
  recentJobs: z.array(platformJobDetailSchema),
  serverStatus: z.string().nullable(),
  sourceImage: z.string().nullable(),
  status: z.string(),
})

export const platformOrganizationDetailSchema = z.object({
  billing: z
    .object({
      currentBalanceCreditsMilli: z.number(),
      currentPeriodEnd: jsonDateSchema.nullable(),
      currentPeriodStart: jsonDateSchema.nullable(),
      totalDebitedCreditsMilli: z.number(),
      totalGrantedCreditsMilli: z.number(),
    })
    .nullable(),
  configuredRuntimeImage: z.string().nullable(),
  configuredRuntimeImageVersion: z.string().nullable(),
  id: z.string(),
  isReady: z.boolean(),
  locale: z.string(),
  name: z.string(),
  observedRuntimeImage: z.string().nullable(),
  observedRuntimeImageVersion: z.string().nullable(),
  slackIntegration: platformSlackIntegrationSchema.nullable(),
  slug: z.string(),
  tenant: platformTenantDetailSchema.nullable(),
  timeFormatPreference: z.string(),
  timezone: z.string(),
})

export const platformOrganizationDetailResponseSchema = z.object({
  gatewayToken: z.string().nullable().optional(),
  organization: platformOrganizationDetailSchema,
})

export const platformUsageTimeSeriesRowSchema = z.object({
  bucketTime: jsonDateSchema,
  creditsBurnedMilli: z.number(),
  inputAudioTokens: z.number(),
  inputCachedTokens: z.number(),
  inputImageTokens: z.number(),
  inputTextTokens: z.number(),
  inputTokens: z.number(),
  outputAudioTokens: z.number(),
  outputTextTokens: z.number(),
  outputTokens: z.number(),
  providerCostMicros: z.number(),
  requestCount: z.number(),
})

export const platformUsageByModelRowSchema = z.object({
  creditsBurnedMilli: z.number(),
  inputTokens: z.number(),
  model: z.string(),
  outputTokens: z.number(),
  providerCostMicros: z.number(),
  requestCount: z.number(),
  totalTokens: z.number(),
  usageType: z.string(),
})

export const platformUsageByTypeRowSchema = z.object({
  creditsBurnedMilli: z.number(),
  providerCostMicros: z.number(),
  requestCount: z.number(),
  totalTokens: z.number(),
  usageType: z.string(),
})

export const platformUsageSchema = z.object({
  summary: z.object({
    activeApiKeys: z.number(),
    activeModels: z.number(),
    totalCreditsBurnedMilli: z.number(),
    totalInputTokens: z.number(),
    totalOutputTokens: z.number(),
    totalProviderCostMicros: z.number(),
    totalRequests: z.number(),
  }),
  timeSeries: z.array(platformUsageTimeSeriesRowSchema),
  usageByModel: z.array(platformUsageByModelRowSchema),
  usageByType: z.array(platformUsageByTypeRowSchema),
})

export const platformUsageQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export const platformActionResponseSchema = z.object({
  desiredStateChanged: z.boolean().optional(),
  desiredStateVersion: z.number().optional(),
  jobId: z.string(),
  queued: z.boolean(),
  tenantId: z.string(),
  tenantName: z.string(),
})

export const platformProvisionServerSchema = z.object({
  provisioningStrategy: z.literal("legacy_base_image"),
})

export const platformProvisionServerResponseSchema =
  platformActionResponseSchema.extend({
    provisionedTenant: z.boolean(),
    provisioningStrategy: z.literal("legacy_base_image"),
  })

export const platformDeleteWorkspaceResponseSchema = z.object({
  jobId: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  queued: z.boolean(),
})

export const platformProvisionOpenAiKeyResponseSchema =
  platformActionResponseSchema.extend({
    action: z.enum(["provision", "rotate"]),
  })

export const platformGrantCreditsSchema = z.object({
  credits: z.number().positive(),
  note: z.string().trim().min(1),
})

export const platformGrantCreditsResponseSchema = z.object({
  balanceCreditsMilli: z.number(),
  grantedCreditsMilli: z.number(),
  ledgerEntryId: z.string(),
  tenantId: z.string(),
  tenantName: z.string(),
})

export const platformJobStatusResponseSchema = z.object({
  error: z.string().nullable(),
  finishedAt: jsonDateSchema.nullable(),
  ok: z.boolean(),
  status: z.string(),
})

export type PlatformActionResponse = z.infer<typeof platformActionResponseSchema>
export type PlatformBootstrap = z.infer<typeof platformBootstrapSchema>
export type PlatformCreateOrganizationInput = z.infer<
  typeof platformCreateOrganizationSchema
>
export type PlatformCreateOrganizationResponse = z.infer<
  typeof platformCreateOrganizationResponseSchema
>
export type PlatformAddCurrentUserAdminResponse = z.infer<
  typeof platformAddCurrentUserAdminResponseSchema
>
export type PlatformDeleteWorkspaceResponse = z.infer<
  typeof platformDeleteWorkspaceResponseSchema
>
export type PlatformEventDetail = z.infer<typeof platformEventDetailSchema>
export type PlatformGrantCreditsInput = z.infer<
  typeof platformGrantCreditsSchema
>
export type PlatformGrantCreditsResponse = z.infer<
  typeof platformGrantCreditsResponseSchema
>
export type PlatformJobDetail = z.infer<typeof platformJobDetailSchema>
export type PlatformJobStatusResponse = z.infer<
  typeof platformJobStatusResponseSchema
>
export type PlatformOrganizationDetail = z.infer<
  typeof platformOrganizationDetailSchema
>
export type PlatformOrganizationDetailResponse = z.infer<
  typeof platformOrganizationDetailResponseSchema
>
export type PlatformOrganizationListItem = z.infer<
  typeof platformOrganizationListItemSchema
>
export type PlatformOrganizationsResponse = z.infer<
  typeof platformOrganizationsResponseSchema
>
export type PlatformProvisionServerInput = z.infer<
  typeof platformProvisionServerSchema
>
export type PlatformProvisionServerResponse = z.infer<
  typeof platformProvisionServerResponseSchema
>
export type PlatformProvisionOpenAiKeyResponse = z.infer<
  typeof platformProvisionOpenAiKeyResponseSchema
>
export type PlatformUsage = z.infer<typeof platformUsageSchema>
