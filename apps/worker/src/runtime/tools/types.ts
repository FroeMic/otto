import type { z } from "zod"
import type { AgentCapability } from "../lib/agent-capabilities"

export type ToolSurfaceScope = "tenant"
export type ToolInstallSource = "registry"
export type ToolInstallState = "installed" | "uninstalled"
export type ToolSurfaceType = "global" | "integration"
export type ToolSurfaceUiGroup = "integrations"
export type ToolSurfaceAction =
  | "install"
  | "uninstall"
  | "enable"
  | "disable"
  | "update"
  | "reapply"

export type ToolFieldMeaning = {
  description: string
  key: string
  label: string
}

export type ToolActionMeaning = {
  action: ToolSurfaceAction
  description: string
  label: string
}

export type ToolAgentOperation = {
  description: string
  key: string
  label: string
}

export type ToolSurfaceLifecycleState = {
  enabled: boolean
  installState: ToolInstallState
}

export type ToolSurfaceResponse<
  Config,
  Options extends Record<string, unknown> = Record<string, never>,
> = {
  actionMeanings: ToolActionMeaning[]
  agentCapabilities?: AgentCapability[]
  agentOperations?: ToolAgentOperation[]
  allowedActions: ToolSurfaceAction[]
  availability?: "available" | "blocked"
  blockingReason?: string | null
  canAgentEdit?: boolean
  canUserEdit?: boolean
  config: Config & {
    enabled: boolean
    entryVersion: number
    installState: ToolInstallState
    schemaVersion: string
  }
  description: string
  derivedEffects?: Record<string, unknown>
  fieldMeanings: ToolFieldMeaning[]
  id: string
  key: string
  kind: string
  label: string
  options: Options
  schema: unknown
  settingsUrl?: string | null
  setupUrl?: string | null
  surfaceType: ToolSurfaceType
  uiGroup: ToolSurfaceUiGroup
  uiHints: unknown
}

export type ToolSurfaceDefinition<
  Config,
  Patch extends Record<string, unknown>,
  Options extends Record<string, unknown> = Record<string, never>,
> = {
  actionMeanings: ToolActionMeaning[]
  agentCapabilities?: AgentCapability[]
  agentOperations?: ToolAgentOperation[]
  buildOptions: (context: {
    orgSlug?: string
    tenantId: string
    tx: unknown
  }) => Promise<Options>
  description: string
  fieldMeanings: ToolFieldMeaning[]
  getDefaultConfig: () => Config
  id: string
  installSource: ToolInstallSource
  key: string
  kind: string
  label: string
  parseConfig: (value: unknown) => Config
  parsePatch: (value: unknown) => Patch
  schema: unknown
  schemaSource: string
  schemaVersion: string
  scope: ToolSurfaceScope
  surfaceType: ToolSurfaceType
  supportsConfig: boolean
  supportsEnable: boolean
  supportsInstall: boolean
  supportsReapply: boolean
  uiGroup: ToolSurfaceUiGroup
  uiHints: unknown
  validateSemantic: (context: {
    config: Config
    orgSlug?: string
    tenantId: string
    tx: unknown
  }) => Promise<void>
}

export type ToolSurfacePatchSchema<T extends Record<string, unknown>> =
  z.ZodType<T>
