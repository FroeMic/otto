import type { ManagedBootstrapFilePath } from "../runtime/managed-config/definition"

export interface AgentInstructionTabDefinition {
  filePath: ManagedBootstrapFilePath
  label: string
  slug: string
}

const AGENT_INSTRUCTION_TABS: AgentInstructionTabDefinition[] = [
  {
    filePath: "AGENTS.md",
    label: "Agent.md",
    slug: "Agent.md",
  },
  {
    filePath: "HEARTBEAT.md",
    label: "Heartbeat.md",
    slug: "Heartbeat.md",
  },
  {
    filePath: "IDENTITY.md",
    label: "Identity.md",
    slug: "Identity.md",
  },
  {
    filePath: "MEMORY.md",
    label: "Memory.md",
    slug: "Memory.md",
  },
  {
    filePath: "SOUL.md",
    label: "Soul.md",
    slug: "Soul.md",
  },
  {
    filePath: "USER.md",
    label: "Users.md",
    slug: "Users.md",
  },
  {
    filePath: "TOOLS.md",
    label: "Tools.md",
    slug: "Tools.md",
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
