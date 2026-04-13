"use client"

import { PlusIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

import {
  type ConversationHistoryFilter,
} from "./conversation-history-filters"
import { ConversationHistoryFilter as ConversationHistoryFilterControl } from "./ConversationHistoryFilter"

export interface ConversationHistoryHeaderProps {
  createDisabled: boolean
  filter: ConversationHistoryFilter
  onCreate: () => void
  onFilterChange: (value: ConversationHistoryFilter) => void
}

export function ConversationHistoryHeader({
  createDisabled,
  filter,
  onCreate,
  onFilterChange,
}: ConversationHistoryHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-sidebar-border/70 bg-sidebar/95 px-2 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate px-1 text-xs font-medium text-sidebar-foreground/70">
          Conversations
        </span>
        <ConversationHistoryFilterControl
          onValueChange={onFilterChange}
          value={filter}
        />
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="New conversation"
        disabled={createDisabled}
        className="rounded-full text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={onCreate}
      >
        <PlusIcon />
      </Button>
    </div>
  )
}

