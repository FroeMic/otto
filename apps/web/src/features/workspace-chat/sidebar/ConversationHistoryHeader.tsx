"use client"

import { CaretDownIcon } from "@phosphor-icons/react"

import {
  type ConversationHistoryFilter,
} from "./conversation-history-filters"
import { ConversationHistoryFilter as ConversationHistoryFilterControl } from "./ConversationHistoryFilter"

export interface ConversationHistoryHeaderProps {
  collapsed: boolean
  filter: ConversationHistoryFilter
  onFilterChange: (value: ConversationHistoryFilter) => void
  onToggleCollapsed: () => void
}

export function ConversationHistoryHeader({
  collapsed,
  filter,
  onFilterChange,
  onToggleCollapsed,
}: ConversationHistoryHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-sidebar/95 px-2 py-2 backdrop-blur">
      <button
        type="button"
        className="flex min-w-0 items-center gap-1 rounded-md px-1 text-xs font-medium text-sidebar-foreground/70 transition hover:text-sidebar-foreground"
        onClick={onToggleCollapsed}
      >
        <CaretDownIcon
          className={`size-3 transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`}
        />
        <span className="truncate">
          Conversations
        </span>
      </button>
      <div className="flex min-w-0 items-center gap-2">
        <ConversationHistoryFilterControl
          onValueChange={onFilterChange}
          value={filter}
        />
      </div>
    </div>
  )
}
