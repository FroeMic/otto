"use client"

import { CaretDownIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  conversationHistoryFilterOptions,
  type ConversationHistoryFilter,
} from "./conversation-history-filters"

export interface ConversationHistoryFilterProps {
  onValueChange: (value: ConversationHistoryFilter) => void
  value: ConversationHistoryFilter
}

export function ConversationHistoryFilter({
  onValueChange,
  value,
}: ConversationHistoryFilterProps) {
  const activeOption =
    conversationHistoryFilterOptions.find((option) => option.value === value) ??
    conversationHistoryFilterOptions[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className="h-6 rounded-full border-sidebar-border bg-sidebar px-2.5 text-[11px] font-medium text-sidebar-foreground/85"
          />
        }
      >
        <span>{activeOption?.label ?? "All"}</span>
        <CaretDownIcon className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36 rounded-2xl">
        {conversationHistoryFilterOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => {
              onValueChange(option.value)
            }}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

