import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

import type { AgentInstructionTab } from "../types"

export interface AgentInstructionTabsProps {
  currentInstructionTab: string
  orgSlug: string
  tabs: AgentInstructionTab[]
}

export function AgentInstructionTabs({
  currentInstructionTab,
  orgSlug,
  tabs,
}: AgentInstructionTabsProps) {
  return (
    <div className="inline-flex w-fit items-center rounded-full bg-muted p-[3px] text-xs text-muted-foreground">
      {tabs.map((tab) => (
        <Link
          key={tab.slug}
          aria-current={currentInstructionTab === tab.slug ? "page" : undefined}
          className={cn(
            "inline-flex h-7 items-center justify-center rounded-full border border-transparent px-2.5 text-xs font-medium transition-colors hover:text-foreground",
            currentInstructionTab === tab.slug
              ? "bg-background text-foreground"
              : "text-foreground/60",
          )}
          params={{ instructionTab: tab.slug, orgSlug }}
          preload="intent"
          to="/$orgSlug/settings/agent/personalization/$instructionTab"
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
