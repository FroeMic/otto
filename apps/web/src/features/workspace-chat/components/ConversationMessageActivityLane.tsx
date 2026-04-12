import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"

import { Badge } from "@/components/ui/badge"

import { buildWorkspaceChatActivityView } from "../activity"

export interface ConversationMessageActivityLaneProps {
  events: WorkspaceChatMessageEvent[]
}

export function ConversationMessageActivityLane({
  events,
}: ConversationMessageActivityLaneProps) {
  if (events.length === 0) {
    return null
  }

  const activityView = buildWorkspaceChatActivityView(events)

  return (
    <details className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="font-medium">{activityView.summaryLabel}</span>
        <span className="text-xs text-muted-foreground">
          {activityView.totalEvents} event
          {activityView.totalEvents === 1 ? "" : "s"}
        </span>
      </summary>

      <div className="mt-3 flex flex-col gap-2">
        {activityView.rows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-border/50 bg-background/80 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{row.title}</p>
              <Badge variant="outline">{row.kind}</Badge>
              {row.status ? (
                <Badge variant="secondary">{row.status}</Badge>
              ) : null}
            </div>
            {row.summary ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {row.summary}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  )
}
