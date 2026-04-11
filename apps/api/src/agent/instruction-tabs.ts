import type { ManagedBootstrapFilePath } from "../runtime/managed-config/definition"

export interface AgentInstructionTabDefinition {
  filePath: ManagedBootstrapFilePath
  label: string
  slug: string
}

const AGENT_INSTRUCTION_TABS: AgentInstructionTabDefinition[] = [
  {
    filePath: "AGENTS.md",
    label: "Working rules",
    slug: "working-rules",
  },
  {
    filePath: "IDENTITY.md",
    label: "Identity",
    slug: "identity",
  },
  {
    filePath: "SOUL.md",
    label: "Values",
    slug: "values",
  },
  {
    filePath: "USER.md",
    label: "People",
    slug: "people",
  },
  {
    filePath: "TOOLS.md",
    label: "Tools",
    slug: "tools",
  },
]

export function getAgentInstructionTabs() {
  return AGENT_INSTRUCTION_TABS
}

export function getDefaultAgentInstructionTab() {
  return AGENT_INSTRUCTION_TABS[0]
}

export function getAgentInstructionTabBySlug(slug: string) {
  return AGENT_INSTRUCTION_TABS.find((tab) => tab.slug === slug) ?? null
}
