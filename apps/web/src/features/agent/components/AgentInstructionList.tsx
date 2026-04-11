import { CaretRightIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"

import { SettingsCard } from "@/client/app/app-shell/SettingsLayout"

import type { AgentInstructionTab } from "../types"

const INSTRUCTION_DESCRIPTIONS: Record<string, string> = {
  "Agent.md": "Core working rules and operating behavior for Otto.",
  "Heartbeat.md": "Short recurring reminders Otto should keep in mind.",
  "Identity.md": "The role, tone, and perspective Otto should adopt.",
  "Memory.md": "Persistent context Otto should keep available over time.",
  "Soul.md": "Values and broader intent that shape Otto's judgment.",
  "Tools.md": "Guidance for how Otto should use tools in this workspace.",
  "Users.md": "Details about the people Otto should know about here.",
}

export interface AgentInstructionListProps {
  orgSlug: string
  tabs: AgentInstructionTab[]
}

function getInstructionMonogram(label: string) {
  return label.replace(".md", "").slice(0, 2).toUpperCase()
}

export function AgentInstructionList({
  orgSlug,
  tabs,
}: AgentInstructionListProps) {
  return (
    <SettingsCard className="overflow-hidden rounded-3xl">
      {tabs.map((tab) => (
        <Link
          key={tab.slug}
          className="group flex items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-muted/30"
          params={{
            instructionTab: tab.slug,
            orgSlug,
          }}
          preload="intent"
          to="/$orgSlug/settings/agent/personalization/$instructionTab"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-xs font-semibold text-muted-foreground">
              {getInstructionMonogram(tab.label)}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{tab.label}</span>
              <span className="text-sm text-muted-foreground">
                {INSTRUCTION_DESCRIPTIONS[tab.slug] ??
                  "Workspace-specific guidance for this Otto instruction file."}
              </span>
            </div>
          </div>

          <CaretRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </SettingsCard>
  )
}
