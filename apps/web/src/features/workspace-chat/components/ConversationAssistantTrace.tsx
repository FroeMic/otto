import type {
  WorkspaceChatMessage,
  WorkspaceChatMessageEvent,
} from "@otto/feature-workspace-chat"
import { useEffect, useState } from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

import {
  buildWorkspaceChatActivityModel,
  type WorkspaceChatActivityEntry,
} from "../activity-model"
import {
  formatWorkspaceChatActivityDuration,
  getActiveTraceLabel,
  getWorkspaceChatPendingLabel,
} from "../trace-presentation"
import { ConversationLiveTraceLine } from "./ConversationLiveTraceLine"
import { TraceCaretIcon } from "./TraceCaretIcon"

export interface ConversationAssistantTraceProps {
  events: WorkspaceChatMessageEvent[]
  startedAt: string
  status:
    | WorkspaceChatMessage["status"]
    | WorkspaceChatMessageEvent["status"]
    | undefined
}

export function ConversationAssistantTrace({
  events,
  startedAt,
  status,
}: ConversationAssistantTraceProps) {
  const activityModel = buildWorkspaceChatActivityModel(events)
  const visibleEntries = activityModel.sections
    .flatMap((section) => section.entries)
    .filter((entry) => entry.visibility !== "debug")
  const isActive =
    status === "pending" || status === "running" || status === "streaming"
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isActive) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isActive])

  if (visibleEntries.length === 0 && !isActive) {
    return null
  }

  if (isActive) {
    const latestEntry = [...visibleEntries].sort(
      (left, right) => right.lastSequence - left.lastSequence,
    )[0]
    const pendingLabel = getWorkspaceChatPendingLabel({
      elapsedMs: Math.max(0, now - Date.parse(startedAt)),
      status,
    })
    const liveLabel = getActiveTraceLabel({
      activityModel,
      fallback: pendingLabel ?? "Working",
    })

    return (
      <ConversationLiveTraceLine
        label={liveLabel}
        sequenceKey={`${latestEntry?.id ?? "pending"}:${latestEntry?.lastSequence ?? 0}`}
      />
    )
  }

  const durationLabel = formatWorkspaceChatActivityDuration({
    endAt: events.at(-1)?.createdAt,
    now,
    startedAt,
  })
  const defaultExpandedEntryId = [...visibleEntries]
    .reverse()
    .find((entry) => shouldCollapseEntry(entry))?.id

  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger className="group flex items-center gap-1.5 py-1 text-left">
        <span className="text-sm font-medium text-foreground/78">
          {durationLabel}
        </span>
        <TraceCaretIcon className="transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="flex flex-col gap-4">
          {visibleEntries.map((entry) => (
            <ConversationTraceEntry
              defaultOpen={entry.id === defaultExpandedEntryId}
              entry={entry}
              key={entry.id}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface ConversationTraceEntryProps {
  defaultOpen: boolean
  entry: WorkspaceChatActivityEntry
}

function ConversationTraceEntry({
  defaultOpen,
  entry,
}: ConversationTraceEntryProps) {
  if (!entry.summary) {
    return (
      <p className={getEntryTitleClassName(entry)}>
        {entry.title}
      </p>
    )
  }

  if (!shouldCollapseEntry(entry)) {
    return (
      <div className="flex flex-col gap-2">
        <p className={getEntryTitleClassName(entry)}>{entry.title}</p>
        <ConversationTraceEntrySummary>{entry.summary}</ConversationTraceEntrySummary>
      </div>
    )
  }

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 py-0.5 text-left">
        <p className={getEntryTitleClassName(entry)}>{entry.title}</p>
        <TraceCaretIcon className="mt-0.5 transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <ConversationTraceEntrySummary>{entry.summary}</ConversationTraceEntrySummary>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ConversationTraceEntrySummary({
  children,
}: {
  children: string
}) {
  return (
    <blockquote className="border-l border-border/80 pl-4 text-sm leading-8 text-muted-foreground">
      {children}
    </blockquote>
  )
}

function getEntryTitleClassName(entry: WorkspaceChatActivityEntry) {
  return cn(
    "text-sm leading-7",
    entry.status === "failed"
      ? "text-foreground/75"
      : "text-foreground/84",
  )
}

function shouldCollapseEntry(entry: WorkspaceChatActivityEntry) {
  if (!entry.summary) {
    return false
  }

  return entry.kind === "thinking" || entry.summary.length > 140
}
