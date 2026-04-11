export const MANAGED_BOOTSTRAP_FILE_PATHS = [
  "AGENTS.md",
  "IDENTITY.md",
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

type ManagedBootstrapFileDefinition = {
  defaultSharedContent: string
  description: string
  label: string
  path: ManagedBootstrapFilePath
  systemContent: string
}

const FILE_DEFINITIONS: Record<
  ManagedBootstrapFilePath,
  ManagedBootstrapFileDefinition
> = {
  "AGENTS.md": {
    defaultSharedContent:
      "## Make It Yours\n\nUse this section for workspace-specific rules that should sit on top of the default Otto template.",
    description:
      "The main workspace playbook. It tells Otto how to start each session and how to work safely here.",
    label: "Working rules",
    path: "AGENTS.md",
    systemContent:
      "AGENTS.md - Your Workspace\n\nRead SOUL.md, USER.md, and recent memory before acting. Keep external actions careful and internal work pragmatic.",
  },
  "IDENTITY.md": {
    defaultSharedContent: "- Name: Otto\n- Vibe: calm, clear, practical",
    description: "Who Otto is. Use this to define its name and presence.",
    label: "Identity",
    path: "IDENTITY.md",
    systemContent:
      "IDENTITY.md - Who Am I?\n\nFill this in during your first conversation. Make it yours.",
  },
  "SOUL.md": {
    defaultSharedContent:
      "## Workspace Flavor\n\n- What good help looks like here\n- What Otto should protect in this workspace",
    description: "Who Otto is at a deeper level: values, tone, and continuity.",
    label: "Values",
    path: "SOUL.md",
    systemContent:
      "SOUL.md - Who You Are\n\nBe genuinely helpful, protect private things, and be careful in shared spaces.",
  },
  "USER.md": {
    defaultSharedContent:
      "### Key People\n\n- Name:\n- What to call them:\n- Notes:",
    description: "About the people Otto is helping in this workspace.",
    label: "People",
    path: "USER.md",
    systemContent:
      "USER.md - About Your People\n\nLearn about the people you're helping. Update this as you go.",
  },
  "TOOLS.md": {
    defaultSharedContent:
      "### Workspace Aliases\n\n- Add local names, aliases, and environment-specific notes here.",
    description:
      "Local notes for this workspace setup, like service names and aliases.",
    label: "Tools",
    path: "TOOLS.md",
    systemContent:
      "TOOLS.md - Local Notes\n\nSkills define how tools work. This file is for specifics unique to this workspace setup.",
  },
}

export function getManagedBootstrapFileDefinitions() {
  return MANAGED_BOOTSTRAP_FILE_PATHS.map((path) => FILE_DEFINITIONS[path])
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
    `- Workspace app base URL: ${ottoBaseUrl}`,
    `- Current workspace slug: ${workspaceSlug}`,
    `- Workspace home: ${ottoBaseUrl}/${workspaceSlug}`,
    `- Skills: ${ottoBaseUrl}/${workspaceSlug}/skills`,
    `- Integrations: ${ottoBaseUrl}/${workspaceSlug}/integrations`,
    `- Otto settings: ${ottoBaseUrl}/${workspaceSlug}/agent`,
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
