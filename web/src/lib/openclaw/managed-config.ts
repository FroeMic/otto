export const MANAGED_BOOTSTRAP_FILE_PATHS = [
  "AGENTS.md",
  "IDENTITY.md",
  "TOOLS.md",
] as const;

export type ManagedBootstrapFilePath =
  (typeof MANAGED_BOOTSTRAP_FILE_PATHS)[number];

export type ManagedBootstrapFileDefinition = {
  path: ManagedBootstrapFilePath;
  label: string;
  description: string;
  systemContent: string;
  defaultSharedContent: string;
};

export type ManagedBootstrapFileInput = {
  path: ManagedBootstrapFilePath;
  systemContent: string;
  sharedContent: string;
};

const MANAGED_BOOTSTRAP_FILE_DEFINITIONS: Record<
  ManagedBootstrapFilePath,
  ManagedBootstrapFileDefinition
> = {
  "AGENTS.md": {
    path: "AGENTS.md",
    label: "Agent rules",
    description:
      "Operational rules for Otto, including how managed config must be changed.",
    systemContent: [
      "Otto is the user-facing agent for this tenant runtime.",
      "The control plane is the source of truth for managed bootstrap files.",
      "When Otto needs to change AGENTS.md, IDENTITY.md, or TOOLS.md, it must use list_managed_files, read_managed_file, and patch_managed_file instead of direct local file writes.",
      "Normal workspace files, generated artifacts, scripts, and memory files remain writable runtime state.",
      "Do not change secrets, gateway security, or sandbox policy through managed bootstrap files.",
    ].join("\n"),
    defaultSharedContent: [
      "Add team-specific operating instructions here.",
      "",
      "- Preferred workflows",
      "- Escalation rules",
      "- Project conventions",
    ].join("\n"),
  },
  "IDENTITY.md": {
    path: "IDENTITY.md",
    label: "Identity",
    description:
      "Who Otto is, who Otto represents, and how Otto should present itself.",
    systemContent: [
      "Your name is Otto.",
      "You are the user-facing agent working for this workspace.",
      "Represent the team's interests and operate as Otto in user-visible interactions.",
    ].join("\n"),
    defaultSharedContent: [
      "Add workspace-specific identity details here.",
      "",
      "- Tone and style",
      "- Responsibilities",
      "- Domain context",
    ].join("\n"),
  },
  "TOOLS.md": {
    path: "TOOLS.md",
    label: "Tool rules",
    description:
      "Instructions about when Otto should use managed-config tools versus normal workspace tools.",
    systemContent: [
      "Use list_managed_files, read_managed_file, and patch_managed_file for AGENTS.md, IDENTITY.md, and TOOLS.md.",
      "Use normal file and exec tools for workspace files, scripts, generated artifacts, MEMORY.md, and memory/*.md.",
      "Do not use managed-config tools to change secrets, gateway auth, sandbox settings, or operator-only policy.",
    ].join("\n"),
    defaultSharedContent: [
      "Add preferred tool usage guidance here.",
      "",
      "- Which tools to prefer first",
      "- Constraints to follow",
      "- Team-specific conventions",
    ].join("\n"),
  },
};

export function getManagedBootstrapFileDefinitions() {
  return MANAGED_BOOTSTRAP_FILE_PATHS.map(
    (path) => MANAGED_BOOTSTRAP_FILE_DEFINITIONS[path],
  );
}

export function getManagedBootstrapFileDefinition(path: string) {
  if (!isManagedBootstrapFilePath(path)) {
    return null;
  }

  return MANAGED_BOOTSTRAP_FILE_DEFINITIONS[path];
}

export function isManagedBootstrapFilePath(
  value: string,
): value is ManagedBootstrapFilePath {
  return MANAGED_BOOTSTRAP_FILE_PATHS.includes(
    value as ManagedBootstrapFilePath,
  );
}

export function buildManagedBootstrapFileContent(
  input: ManagedBootstrapFileInput,
) {
  return [
    `# ${input.path}`,
    "",
    "<!-- BEGIN SYSTEM -->",
    input.systemContent.trim(),
    "<!-- END SYSTEM -->",
    "",
    "<!-- BEGIN SHARED -->",
    input.sharedContent.trim(),
    "<!-- END SHARED -->",
    "",
  ].join("\n");
}
