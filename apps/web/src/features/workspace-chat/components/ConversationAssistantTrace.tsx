import {
  CaretDownIcon,
  FileTextIcon,
  GearSixIcon,
  HandPalmIcon,
  MagnifyingGlassIcon,
  ToolboxIcon,
} from "@phosphor-icons/react"
import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { buildWorkspaceChatActivityModel } from "../activity-model"
import {
  formatWorkspaceChatActivityDuration,
  getActivityLeadLine,
  getActivityLeadTitle,
} from "../trace-presentation"

export interface ConversationAssistantTraceProps {
  events: WorkspaceChatMessageEvent[]
  startedAt: string
}

export function ConversationAssistantTrace({
  events,
  startedAt,
}: ConversationAssistantTraceProps) {
  if (events.length === 0) {
    return null
  }

  const activityModel = buildWorkspaceChatActivityModel(events)
  const visibleSections = activityModel.sections
    .map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => entry.visibility !== "debug"),
    }))
    .filter((section) => {
      if (section.kind === "system") {
        return false
      }

      return section.entries.length > 0
    })

  if (visibleSections.length === 0) {
    return null
  }

  const isActive =
    activityModel.status === "pending" || activityModel.status === "running"
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

  const activeLabel =
    activityModel.activeCount > 0
      ? `${activityModel.activeCount} active`
      : `${visibleSections.reduce(
          (total, section) => total + section.entries.length,
          0,
        )} steps`
  const durationLabel = formatWorkspaceChatActivityDuration({
    endAt: isActive ? undefined : events.at(-1)?.createdAt,
    now,
    startedAt,
  })
  const leadTitle = getActivityLeadTitle({
    activityModel,
    fallback: "Tracing this reply",
  })
  const leadLine = getActivityLeadLine({
    activityModel,
    fallback: getTraceStatusLabel(activityModel.status),
  })

  return (
    <Collapsible className="w-full" defaultOpen={activityModel.activeCount > 0}>
      <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-muted/20">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <p>{durationLabel}</p>
            <Badge className="px-1.5 py-0 text-[10px]" variant="outline">
              {activeLabel}
            </Badge>
          </div>
          <p className="text-sm font-medium text-foreground">{leadTitle}</p>
          <p className="text-sm text-muted-foreground">{leadLine}</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {activityModel.activeCount > 0 ? (
            <span className="size-2 rounded-full bg-primary/70" />
          ) : null}
          <CaretDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="ml-2 flex flex-col gap-4 border-l border-border/50 pl-4">
          {visibleSections.map((section) => (
            <div className="flex flex-col gap-2" key={section.kind}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {section.title}
                </p>
                <Badge className="px-1.5 py-0 text-[10px]" variant="secondary">
                  {section.status}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {section.entries.map((entry) => (
                  <div
                    className="rounded-xl border border-border/40 bg-background/70 px-3 py-2.5"
                    key={entry.id}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-muted-foreground">
                        <TraceEntryIcon kind={entry.presentation?.kind} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{entry.title}</p>
                          {entry.presentation?.iconKey ? (
                            <Badge
                              className="px-1.5 py-0 text-[10px]"
                              variant="outline"
                            >
                              {entry.presentation.iconKey}
                            </Badge>
                          ) : null}
                          <Badge
                            className="px-1.5 py-0 text-[10px]"
                            variant="secondary"
                          >
                            {entry.status}
                          </Badge>
                        </div>
                        {entry.summary ? (
                          <p className="text-sm text-muted-foreground">
                            {entry.summary}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function getTraceStatusLabel(status: WorkspaceChatMessageEvent["status"]) {
  if (status === "running" || status === "pending") {
    return "Otto is working through the current turn."
  }

  if (status === "failed") {
    return "The turn finished with a failure."
  }

  if (status === "blocked") {
    return "The turn is blocked on a required step."
  }

  return "Completed activity for this assistant response."
}

function TraceEntryIcon({
  kind,
}: {
  kind?: string
}) {
  if (kind === "memory" || kind === "skill") {
    return <FileTextIcon className="size-4" />
  }

  if (kind === "search") {
    return <MagnifyingGlassIcon className="size-4" />
  }

  if (kind === "config" || kind === "write") {
    return <GearSixIcon className="size-4" />
  }

  if (kind === "approval") {
    return <HandPalmIcon className="size-4" />
  }

  return <ToolboxIcon className="size-4" />
}
