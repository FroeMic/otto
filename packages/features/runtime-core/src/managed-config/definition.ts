import { GENERATED_MANAGED_BOOTSTRAP_FILE_DEFINITIONS } from "./generated-managed-config"

export const MANAGED_BOOTSTRAP_FILE_PATHS = [
  "AGENTS.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "MEMORY.md",
  "SOUL.md",
  "USER.md",
  "TOOLS.md",
] as const

const LEGACY_FILE_ALIASES = {
  "USERS.md": "USER.md",
} as const

export type ManagedBootstrapFilePath =
  (typeof MANAGED_BOOTSTRAP_FILE_PATHS)[number]

export type ManagedBootstrapRuntimeContext = {
  ottoBaseUrl?: string | null
  workspaceSlug?: string | null
}

export type ManagedBootstrapFileDefinition = {
  defaultSharedContent: string
  description: string
  label: string
  path: ManagedBootstrapFilePath
  systemContent: string
}

export function getManagedBootstrapFileDefinitions() {
  return [...GENERATED_MANAGED_BOOTSTRAP_FILE_DEFINITIONS]
}

export function getManagedBootstrapFileDefinition(path: string) {
  const normalizedPath = normalizeManagedBootstrapFilePath(path)

  if (!normalizedPath) {
    return null
  }

  return (
    GENERATED_MANAGED_BOOTSTRAP_FILE_DEFINITIONS.find(
      (definition) => definition.path === normalizedPath,
    ) ?? null
  )
}

export function normalizeManagedBootstrapFilePath(
  value: string,
): ManagedBootstrapFilePath | null {
  if ((MANAGED_BOOTSTRAP_FILE_PATHS as readonly string[]).includes(value)) {
    return value as ManagedBootstrapFilePath
  }

  const aliased = LEGACY_FILE_ALIASES[value as keyof typeof LEGACY_FILE_ALIASES]
  return aliased ?? null
}

function normalizeOttoBaseUrl(value?: string | null) {
  const trimmed = value?.trim().replace(/\/+$/, "")
  return trimmed || null
}

function normalizeWorkspaceSlug(value?: string | null) {
  const trimmed = value?.trim().replace(/^\/+|\/+$/g, "")
  return trimmed || null
}

export function buildManagedBootstrapSystemContent(input: {
  path: ManagedBootstrapFilePath
  runtimeContext?: ManagedBootstrapRuntimeContext
  systemContent: string
}) {
  const baseSystemContent = input.systemContent.trim()

  if (input.path !== "TOOLS.md") {
    return baseSystemContent
  }

  const ottoBaseUrl = normalizeOttoBaseUrl(input.runtimeContext?.ottoBaseUrl)
  const workspaceSlug = normalizeWorkspaceSlug(
    input.runtimeContext?.workspaceSlug,
  )

  if (!ottoBaseUrl || !workspaceSlug) {
    return baseSystemContent
  }

  return [
    baseSystemContent,
    "",
    "## Workspace App Context",
    "",
    "- When a user asks where to change agent settings in the workspace app, answer with the full URL when possible.",
    `- Workspace app base URL: ${ottoBaseUrl}`,
    `- Current workspace slug: ${workspaceSlug}`,
    "",
    "### Known Workspace URLs",
    "",
    `- Workspace home: ${ottoBaseUrl}/${workspaceSlug}`,
    `- Skills: ${ottoBaseUrl}/${workspaceSlug}/skills`,
    `- Integrations: ${ottoBaseUrl}/${workspaceSlug}/settings/agent/integrations`,
    `- Agent settings: ${ottoBaseUrl}/${workspaceSlug}/settings/agent/personalization`,
    `- Scheduled tasks: ${ottoBaseUrl}/${workspaceSlug}/scheduled-tasks`,
    `- Workspace settings: ${ottoBaseUrl}/${workspaceSlug}/settings/workspace`,
    `- User settings: ${ottoBaseUrl}/${workspaceSlug}/settings/user`,
  ].join("\n")
}

export function buildManagedBootstrapFileContent(input: {
  path: ManagedBootstrapFilePath
  runtimeContext?: ManagedBootstrapRuntimeContext
  sharedContent: string
  systemContent: string
}) {
  const systemContent = buildManagedBootstrapSystemContent(input)

  return [
    `# ${input.path}`,
    "",
    "<!-- BEGIN SYSTEM -->",
    systemContent,
    "<!-- END SYSTEM -->",
    "",
    "<!-- BEGIN SHARED -->",
    input.sharedContent.trim(),
    "<!-- END SHARED -->",
    "",
  ].join("\n")
}
