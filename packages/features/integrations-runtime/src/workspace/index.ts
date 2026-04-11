import { z } from "zod"

export const workspaceIntegrationKeySchema = z.enum([
  "brave",
  "linear",
  "slack",
])

export const workspaceIntegrationCapabilityPolicySchema = z.object({
  policy: z.enum(["allow", "block"]),
})

export const workspaceIntegrationCapabilityStateSchema = z.object({
  reason: z.string().optional(),
  status: z.enum(["disabled", "enabled", "needs_attention"]),
})

export const workspaceIntegrationCapabilityRowSchema = z.object({
  capabilityKey: z.string().min(1),
  capabilityType: z.enum(["command", "trigger"]),
  commandGroup: z.string().nullable(),
  description: z.string(),
  effect: z.enum(["read", "write"]).nullable(),
  label: z.string().min(1),
  policy: workspaceIntegrationCapabilityPolicySchema.nullable(),
  reason: z.string().nullable(),
  sourceIcon: z.string().nullable(),
  sourceLabel: z.string().min(1),
  sourceType: z.literal("integration"),
  status: workspaceIntegrationCapabilityStateSchema.shape.status,
  userControllable: z.boolean(),
})

export const workspaceManagedIntegrationSummarySchema = z.object({
  connectedAt: z.string().nullable(),
  disconnectedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
  providerKey: workspaceIntegrationKeySchema,
  status: z.string().nullable(),
})

export const workspaceIntegrationCatalogEntrySchema = z.object({
  categoryLabel: z.string().min(1),
  connected: z.boolean(),
  description: z.string().min(1),
  iconSrc: z.string().nullable(),
  key: workspaceIntegrationKeySchema,
  label: z.string().min(1),
  managementMode: z.enum(["platform_managed", "workspace_managed"]),
  needsAttention: z.boolean(),
  settingsPath: z.string().min(1),
})

export const workspaceIntegrationsResponseSchema = z.object({
  integrations: z.array(workspaceIntegrationCatalogEntrySchema),
})

export const workspaceIntegrationActionSchema = z.object({
  availableActions: z.array(z.string()),
  connectUrl: z.string().nullable(),
  integrationKey: workspaceIntegrationKeySchema,
  label: z.string().min(1),
  message: z.string().min(1),
  recommendedAction: z.string().min(1),
  requiresUserAction: z.boolean(),
  selectedAction: z.string().min(1),
  status: z.object({
    connected: z.boolean(),
    connectionStatus: z.string().nullable(),
    enabled: z.boolean(),
    integrationStatus: z.string().nullable(),
    needsAttention: z.boolean(),
  }),
  workspaceUrl: z.string().nullable(),
})

export const runtimeIntegrationSettingsExampleSchema = z.object({
  call: z.object({
    action: z.enum(["apply", "get", "validate"]),
    expectedEntryVersion: z.union([z.number(), z.string()]).optional(),
    integrationKey: z.string().min(1),
    patch: z.record(z.string(), z.unknown()).optional(),
    summary: z.string().optional(),
  }),
  description: z.string().min(1),
})

export const runtimeIntegrationSettingsEditableFieldSchema = z.object({
  currentValue: z.unknown(),
  description: z.string().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  schema: z.record(z.string(), z.unknown()),
  uiHint: z.unknown().optional(),
})

export const runtimeIntegrationSettingsContractSchema = z.object({
  editableFields: z.array(runtimeIntegrationSettingsEditableFieldSchema),
  examples: z.array(runtimeIntegrationSettingsExampleSchema),
  patchSchema: z.object({
    additionalProperties: z.boolean().optional(),
    properties: z.record(z.string(), z.record(z.string(), z.unknown())),
    type: z.literal("object"),
  }),
  recommendedWorkflow: z.array(z.string()),
  settingsLabel: z.string().min(1),
  settingsToolName: z.literal("configure_integration"),
})

export const workspaceIntegrationSurfaceSchema = z.object({
  availableChannels: z.array(z.unknown()).optional(),
  availableUsers: z.array(z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  derivedEffects: z.unknown().optional(),
  fieldMeanings: z.array(z.unknown()).optional(),
  allowedActions: z.array(z.string()).optional(),
  availability: z.enum(["available", "blocked"]).optional(),
  blockingReason: z.string().nullable().optional(),
  canAgentEdit: z.boolean().optional(),
  canUserEdit: z.boolean().optional(),
  description: z.string().optional(),
  label: z.string().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  settingsUrl: z.string().nullable().optional(),
  setupUrl: z.string().nullable().optional(),
  uiHints: z.unknown().optional(),
})

export const workspaceIntegrationSettingsSchema = z.object({
  contract: runtimeIntegrationSettingsContractSchema,
  surface: workspaceIntegrationSurfaceSchema,
})

export const workspaceIntegrationDetailSchema = z.object({
  availableSections: z.array(z.string().min(1)),
  capabilities: z.array(workspaceIntegrationCapabilityRowSchema),
  connection: workspaceIntegrationActionSchema,
  integration: z.object({
    categoryLabel: z.string().min(1),
    description: z.string().min(1),
    iconSrc: z.string().nullable(),
    key: workspaceIntegrationKeySchema,
    label: z.string().min(1),
    managementMode: z.enum(["platform_managed", "workspace_managed"]),
    pageDescription: z.string().min(1),
  }),
  settings: workspaceIntegrationSettingsSchema.nullable(),
  summary: workspaceManagedIntegrationSummarySchema.nullable(),
})

export const workspaceIntegrationDisconnectResponseSchema = z.object({
  applyQueued: z.boolean(),
  status: z.string().min(1),
})

export const workspaceIntegrationCapabilityPolicyUpdateSchema = z.object({
  policy: z.enum(["allow", "block"]),
})

export const workspaceIntegrationCapabilityPolicyResponseSchema = z.object({
  row: workspaceIntegrationCapabilityRowSchema,
})

export const workspaceSlackChannelMembershipUpdateSchema = z.object({
  action: z.enum(["join", "leave"]),
})

export const workspaceSlackDirectoryResyncSchema = z.object({
  action: z.enum(["channels", "users"]),
})

export const workspaceSlackDirectoryResyncResponseSchema = z.object({
  jobId: z.string().min(1),
  ok: z.literal(true),
})

export const workspaceJobStatusResponseSchema = z.object({
  error: z.string().nullable(),
  finishedAt: z.string().nullable(),
  ok: z.boolean(),
  status: z.string().min(1),
})

export const workspaceSlackChannelMembershipResponseSchema = z.object({
  applyQueued: z.boolean().optional(),
  surface: workspaceIntegrationSurfaceSchema,
})

export const workspaceSlackSettingsPatchSchema = z.object({
  allowDestructiveChanges: z.boolean().optional(),
  expectedEntryVersion: z.number().int().positive().optional(),
  patch: z.record(z.string(), z.unknown()),
  summary: z.string().trim().min(1).max(500).optional(),
})

export const workspaceIntegrationSettingsValidationSchema = z.object({
  ok: z.boolean(),
  warnings: z.array(z.string()),
})

export const workspaceSlackSettingsUpdateResponseSchema = z.object({
  applyQueued: z.boolean().optional(),
  changed: z.boolean().optional(),
  currentEntryVersion: z.number().int().positive().optional(),
  desiredStateVersion: z.number().int().positive().optional(),
  installState: z.string().optional(),
  surface: workspaceIntegrationSurfaceSchema,
  validation: workspaceIntegrationSettingsValidationSchema,
})

export type WorkspaceIntegrationCatalogEntry = z.infer<
  typeof workspaceIntegrationCatalogEntrySchema
>
export type WorkspaceIntegrationCapabilityRow = z.infer<
  typeof workspaceIntegrationCapabilityRowSchema
>
export type WorkspaceIntegrationDetail = z.infer<
  typeof workspaceIntegrationDetailSchema
>
export type WorkspaceIntegrationSettings = z.infer<
  typeof workspaceIntegrationSettingsSchema
>
export type WorkspaceIntegrationDisconnectResponse = z.infer<
  typeof workspaceIntegrationDisconnectResponseSchema
>
export type WorkspaceIntegrationCapabilityPolicyResponse = z.infer<
  typeof workspaceIntegrationCapabilityPolicyResponseSchema
>
export type WorkspaceSlackChannelMembershipResponse = z.infer<
  typeof workspaceSlackChannelMembershipResponseSchema
>
export type WorkspaceSlackDirectoryResyncResponse = z.infer<
  typeof workspaceSlackDirectoryResyncResponseSchema
>
export type WorkspaceJobStatusResponse = z.infer<
  typeof workspaceJobStatusResponseSchema
>
export type WorkspaceSlackSettingsUpdateResponse = z.infer<
  typeof workspaceSlackSettingsUpdateResponseSchema
>
