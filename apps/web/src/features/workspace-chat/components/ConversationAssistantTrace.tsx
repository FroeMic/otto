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
      seed: startedAt,
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

  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger className="group flex items-center gap-1 py-0.5 text-left">
        <span className="text-xs font-medium text-foreground/70">
          {durationLabel}
        </span>
        <TraceCaretIcon className="transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1.5">
        <div className="flex flex-col gap-0">
          {visibleEntries.map((entry) => (
            <ConversationTraceEntry entry={entry} key={entry.id} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface ConversationTraceEntryProps {
  entry: WorkspaceChatActivityEntry
}

function ConversationTraceEntry({ entry }: ConversationTraceEntryProps) {
  if (!entry.summary) {
    return (
      <p className={cn(getEntryTitleClassName(entry), "py-1.5")}>
        {entry.title}
      </p>
    )
  }

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="group flex items-center gap-1 py-1.5 text-left">
        <p className={getEntryTitleClassName(entry)}>{entry.title}</p>
        <TraceCaretIcon className="transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-0.5 pb-1">
        <ConversationTraceEntrySummary>
          {entry.summary}
        </ConversationTraceEntrySummary>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ConversationTraceEntrySummary({ children }: { children: string }) {
  return (
    <blockquote className="ml-2 border-l border-border/65 pl-3 text-xs leading-5 text-muted-foreground/88">
      {children}
    </blockquote>
  )
}

function getEntryTitleClassName(entry: WorkspaceChatActivityEntry) {
  return cn(
    "text-xs leading-5",
    entry.status === "failed" ? "text-foreground/66" : "text-foreground/74",
  )
}
