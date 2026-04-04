import type { ManagedBootstrapFilePath } from "@/lib/openclaw/managed-config";

export type AgentInstructionTab = {
  actualPath: ManagedBootstrapFilePath;
  label: string;
  slug: string;
};

const AGENT_INSTRUCTION_TABS: AgentInstructionTab[] = [
  {
    actualPath: "AGENTS.md",
    label: "Agent.md",
    slug: "Agent.md",
  },
  {
    actualPath: "IDENTITY.md",
    label: "Identity.md",
    slug: "Identity.md",
  },
  {
    actualPath: "SOUL.md",
    label: "Soul.md",
    slug: "Soul.md",
  },
  {
    actualPath: "USER.md",
    label: "Users.md",
    slug: "Users.md",
  },
  {
    actualPath: "TOOLS.md",
    label: "Tools.md",
    slug: "Tools.md",
  },
];

export function getAgentInstructionTabs() {
  return AGENT_INSTRUCTION_TABS;
}

export function getDefaultAgentInstructionTab() {
  return AGENT_INSTRUCTION_TABS[0];
}

export function getAgentInstructionTabBySlug(slug: string) {
  return AGENT_INSTRUCTION_TABS.find((tab) => tab.slug === slug) ?? null;
}
