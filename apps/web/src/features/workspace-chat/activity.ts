import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"

import {
  buildWorkspaceChatActivityModel,
  type WorkspaceChatActivityEntry,
  type WorkspaceChatActivityPresentation,
} from "./activity-model"

export interface WorkspaceChatActivityRow {
  events: WorkspaceChatMessageEvent["type"][]
  id: string
  kind: "approval" | "command_output" | "item" | "lifecycle" | "tool"
  presentation?: WorkspaceChatActivityPresentation
  status: WorkspaceChatMessageEvent["status"]
  summary?: string
  title: string
}

export interface WorkspaceChatActivityView {
  activeCount: number
  rows: WorkspaceChatActivityRow[]
  summaryLabel: string
  totalEvents: number
}

export function buildWorkspaceChatActivityView(
  messageEvents: WorkspaceChatMessageEvent[],
): WorkspaceChatActivityView {
  const activityModel = buildWorkspaceChatActivityModel(messageEvents)
  const rows = activityModel.sections.flatMap((section) =>
    section.entries
      .filter((entry) => shouldRenderActivityEntry(entry))
      .map((entry) => ({
        events: entry.events.map((event) => event.type),
        id: entry.id,
        kind: getActivityRowKind(entry),
        ...(entry.presentation ? { presentation: entry.presentation } : {}),
        status: entry.status,
        summary: entry.summary,
        title: entry.title,
      })),
  )
  const activeCount = rows.filter((row) => isActiveStatus(row.status)).length

  return {
    activeCount,
    rows,
    summaryLabel:
      activeCount > 0
        ? `Activity (${activeCount} active)`
        : `Activity (${rows.length} steps)`,
    totalEvents: activityModel.eventCount,
  }
}

function shouldRenderActivityEntry(entry: WorkspaceChatActivityEntry) {
  return entry.visibility === "primary"
}

function getActivityRowKind(
  entry: WorkspaceChatActivityEntry,
): WorkspaceChatActivityRow["kind"] {
  if (
    entry.kind === "approval" ||
    entry.kind === "command_output" ||
    entry.kind === "item" ||
    entry.kind === "lifecycle" ||
    entry.kind === "tool"
  ) {
    return entry.kind
  }

  return "item"
}

function isActiveStatus(status: WorkspaceChatMessageEvent["status"]) {
  return status === "blocked" || status === "pending" || status === "running"
}
