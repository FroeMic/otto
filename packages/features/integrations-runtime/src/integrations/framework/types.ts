import type { ConnectedApiCredentialRecord } from "../../db/api-credentials"
import type { ConnectedOauthAccessRecord } from "../../db/oauth"
import type { AgentCapability } from "../../lib/agent-capabilities"
import type { OAuthProviderDefinition } from "../../lib/oauth/providers/types"

export type IntegrationCommandInputMode =
  | "file_ref"
  | "json"
  | "json_and_file_ref"

export type IntegrationCommandResultMode = "download_url" | "file_ref" | "json"

export type IntegrationCapabilityPolicy = {
  policy: "allow" | "block"
}

export type IntegrationCommandEffect = "read" | "write"

export type IntegrationCommandSafety = "destructive" | "normal"

export type IntegrationCommandActivityPresentationKind =
  | "config"
  | "memory"
  | "read"
  | "search"
  | "skill"
  | "write"
  | (string & {})

export type IntegrationCommandActivityPresentationIconKey =
  | "linear"
  | "memory"
  | "skill"
  | (string & {})

export type IntegrationCommandActivityPresentationSource = {
  commandKey: string
  integrationKey: string
  kind: "integration_command"
}

export type IntegrationCommandActivityPresentation = {
  iconKey?: IntegrationCommandActivityPresentationIconKey
  kind: IntegrationCommandActivityPresentationKind
  source?: IntegrationCommandActivityPresentationSource
  title: string
}

export type RuntimeCapabilityState = {
  reason?: string
  status: "disabled" | "enabled" | "needs_attention"
}

export type IntegrationCommandDefinition = {
  agentAvailability?: {
    available: boolean
    reason: string
  }
  activityPresentation?: IntegrationCommandActivityPresentation
  argumentsSchema: Record<string, unknown>
  commandKey: string
  commandPath: string[]
  description: string
  effect?: IntegrationCommandEffect
  exampleArguments?: Record<string, unknown>
  inputMode: IntegrationCommandInputMode
  intentKeywords?: string[]
  label: string
  resultMode: IntegrationCommandResultMode
  requiredProviderScopes?: string[]
  safety?: IntegrationCommandSafety
  userControllable?: boolean
  usageNotes?: string[]
}

export type IntegrationCommandExecute = (input: {
  arguments: Record<string, unknown>
  context: IntegrationExecutionContext
}) => Promise<unknown>

export type IntegrationCommandValidate = (
  arguments_: Record<string, unknown>,
) => Record<string, unknown>

export type IntegrationRuntimeCommandDefinition =
  IntegrationCommandDefinition & {
    execute: IntegrationCommandExecute
    validate?: IntegrationCommandValidate
  }

export type IntegrationCommandGroupDefinition = {
  childGroups?: IntegrationRuntimeCommandGroupDefinition[]
  commands?: IntegrationRuntimeCommandDefinition[]
  description: string
  groupKey: string
  groupPath: string[]
  intentKeywords?: string[]
  label: string
}

export type IntegrationRuntimeCommandGroupDefinition =
  IntegrationCommandGroupDefinition

export type IntegrationRuntimeSurfaceDefinition = {
  commandGroups: IntegrationRuntimeCommandGroupDefinition[]
  rootCommands: IntegrationRuntimeCommandDefinition[]
  toolDescription: string
  toolName: string
}

export type RuntimeIntegrationManifestEntry = {
  commandGroups: RuntimeIntegrationCommandGroupSummary[]
  description: string
  key: string
  label: string
  rootCommands: RuntimeIntegrationCommandSummary[]
  toolDescription: string
  toolName: string
}

export type RuntimeIntegrationStatus = {
  connected: boolean
  connectionStatus: string | null
  enabled: boolean
  integrationStatus: string | null
  needsAttention: boolean
}

export type RuntimeIntegrationUsageGuide = {
  connectionToolName: "manage_integration"
  detailToolName: "get_integration_details"
  discoveryToolName: "find_integration_commands"
  executeToolName: "execute_integration_command"
  inventoryToolName: "list_integrations"
  settingsToolName: "configure_integration"
  recommendedWorkflow: string[]
}

export type RuntimeIntegrationSettingsSummary = {
  description?: string
  examples: RuntimeIntegrationSettingsExample[]
  label: string
  recommendedWorkflow: string[]
  toolName: "configure_integration"
}

export type RuntimeIntegrationSettingsExample = {
  call: {
    action: "apply" | "get" | "validate"
    expectedEntryVersion?: number | string
    integrationKey: string
    patch?: Record<string, unknown>
    summary?: string
  }
  description: string
}

export type RuntimeIntegrationSettingsEditableField = {
  currentValue: unknown
  description?: string
  key: string
  label: string
  schema: Record<string, unknown>
  uiHint?: unknown
}

export type RuntimeIntegrationSettingsContract = {
  editableFields: RuntimeIntegrationSettingsEditableField[]
  examples: RuntimeIntegrationSettingsExample[]
  patchSchema: {
    additionalProperties?: boolean
    properties: Record<string, Record<string, unknown>>
    type: "object"
  }
  recommendedWorkflow: string[]
  settingsLabel: string
  settingsToolName: "configure_integration"
}

export type RuntimeIntegrationCommandSummary = {
  commandKey: string
  commandPath: string[]
  label: string
}

export type RuntimeIntegrationCommandGroupSummary = {
  commandCount: number
  groupKey: string
  groupPath: string[]
  label: string
}

export type RuntimeIntegrationSummaryResponse = {
  available: boolean
  commandGroups: RuntimeIntegrationCommandGroupSummary[]
  description: string
  installed: boolean
  key: string
  label: string
  rootCommands: RuntimeIntegrationCommandSummary[]
  settings: RuntimeIntegrationSettingsSummary | null
  status: RuntimeIntegrationStatus
  toolDescription: string
  toolName: string
  usageGuide: RuntimeIntegrationUsageGuide
}

export type RuntimeIntegrationCommandDetails = {
  activityPresentation?: IntegrationCommandActivityPresentation
  argumentsSchema: Record<string, unknown>
  capabilityState: RuntimeCapabilityState
  commandKey: string
  commandPath: string[]
  description: string
  exampleArguments: Record<string, unknown>
  exampleCall: {
    arguments: Record<string, unknown>
    commandKey: string
    integrationKey: string
  }
  inputMode: IntegrationCommandInputMode
  label: string
  policy: IntegrationCapabilityPolicy | null
  resultMode: IntegrationCommandResultMode
  userControllable: boolean
  usageNotes: string[]
}

export type RuntimeIntegrationCommandGroupDetails = {
  childGroups: RuntimeIntegrationCommandGroupSummary[]
  commands: RuntimeIntegrationCommandSummary[]
  description: string
  groupKey: string
  groupPath: string[]
  label: string
}

export type RuntimeIntegrationDetailsResponse = {
  command?: RuntimeIntegrationCommandDetails
  detailType: "command" | "command_group"
  group?: RuntimeIntegrationCommandGroupDetails
  integration: Pick<
    RuntimeIntegrationSummaryResponse,
    "description" | "key" | "label" | "settings" | "status" | "usageGuide"
  >
}

export type RuntimeIntegrationCommandMatch = {
  activityPresentation?: IntegrationCommandActivityPresentation
  commandGroupPath: string[]
  commandKey: string
  commandLabel: string
  connected: boolean
  exampleArguments: Record<string, unknown>
  integrationKey: string
  integrationLabel: string
  needsAttention: boolean
  reason: string
}

export type IntegrationExecutionContext = {
  auth:
    | (ConnectedApiCredentialRecord & {
        accessToken: never
        kind: "api_key"
      })
    | (ConnectedOauthAccessRecord & {
        apiKey: never
        kind: "oauth"
      })
    | null
  tenantIntegrationId: string | null
}

export type IntegrationOauthBinding = {
  provider: OAuthProviderDefinition
}

export type IntegrationAuthBinding =
  | {
      credentialType: "personal_api_key" | (string & {})
      kind: "api_key"
    }
  | {
      kind: "oauth"
      provider: OAuthProviderDefinition
    }

export type IntegrationIngressSetupMode =
  | "manual"
  | "platform_managed"
  | "provider_managed"
  | "workspace_managed"

export type IntegrationIngressEndpointDefinition = {
  description?: string
  endpointKey: string
  label: string
}

export type IntegrationIngressDefinition = {
  endpoints: IntegrationIngressEndpointDefinition[]
  setupMode: IntegrationIngressSetupMode
}

export type IntegrationOverviewEntry = {
  capabilitySummary: {
    reads: number
    tools: number
    triggers: number
  } | null
  categoryLabel: string
  connected: boolean
  description: string
  key: string
  label: string
  needsAttention: boolean
  settingsPath: string
}

export type IntegrationSettingsDefinition = {
  description?: string
  examples?: Array<{
    action: "apply" | "get" | "validate"
    description: string
    expectedEntryVersion?: number | string
    patch?: Record<string, unknown>
    summary?: string
  }>
  label: string
  recommendedWorkflow?: string[]
}

export type IntegrationManagementMode = "platform_managed" | "workspace_managed"

export type IntegrationDefinition = {
  agentCapabilities: AgentCapability[]
  auth?: IntegrationAuthBinding
  categoryLabel: string
  catalogDescription: string
  description: string
  iconSrc: string | null
  ingress?: IntegrationIngressDefinition
  key: string
  label: string
  managementMode?: IntegrationManagementMode
  oauth?: IntegrationOauthBinding
  pageDescription: string
  resolveStatus?: () => RuntimeIntegrationStatus
  runtimeSurface: IntegrationRuntimeSurfaceDefinition | null
  settings?: IntegrationSettingsDefinition
  settingsPath: (orgSlug: string) => string
  showInWorkspaceCatalog: boolean
}
