import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"

export interface WorkspaceChatActivityRow {
  events: WorkspaceChatMessageEvent["type"][]
  id: string
  kind: "approval" | "command_output" | "item" | "lifecycle" | "tool"
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
  const sortedEvents = [...messageEvents].sort(
    (left, right) => left.sequence - right.sequence,
  )
  const rowsById = new Map<string, WorkspaceChatActivityRow>()

  for (const messageEvent of sortedEvents) {
    const kind = getActivityKind(messageEvent.type)
    const rowId = getActivityRowId(messageEvent, kind)
    const existingRow = rowsById.get(rowId)

    if (!existingRow) {
      rowsById.set(rowId, {
        events: [messageEvent.type],
        id: rowId,
        kind,
        status: messageEvent.status,
        summary: messageEvent.summary,
        title: messageEvent.title ?? getFallbackTitle(kind),
      })
      continue
    }

    existingRow.events.push(messageEvent.type)
    existingRow.status = messageEvent.status
    existingRow.summary = messageEvent.summary ?? existingRow.summary
    existingRow.title = messageEvent.title ?? existingRow.title
  }

  const rows = [...rowsById.values()]
  const activeCount = rows.filter(
    (row) =>
      row.status === "running" ||
      row.status === "pending" ||
      row.status === "blocked",
  ).length

  return {
    activeCount,
    rows,
    summaryLabel:
      activeCount > 0
        ? `Activity (${activeCount} active)`
        : `Activity (${rows.length} steps)`,
    totalEvents: sortedEvents.length,
  }
}

function getActivityKind(
  type: WorkspaceChatMessageEvent["type"],
): WorkspaceChatActivityRow["kind"] {
  const prefix = type.split(".")[0]

  if (
    prefix === "approval" ||
    prefix === "command_output" ||
    prefix === "item" ||
    prefix === "lifecycle" ||
    prefix === "tool"
  ) {
    return prefix
  }

  return "item"
}

function getActivityRowId(
  messageEvent: WorkspaceChatMessageEvent,
  kind: WorkspaceChatActivityRow["kind"],
) {
  if (messageEvent.itemId) {
    return `${kind}:${messageEvent.itemId}`
  }

  if (kind === "lifecycle") {
    return "lifecycle"
  }

  return `${kind}:${messageEvent.id}`
}

function getFallbackTitle(kind: WorkspaceChatActivityRow["kind"]) {
  if (kind === "approval") {
    return "Approval"
  }

  if (kind === "command_output") {
    return "Command output"
  }

  if (kind === "lifecycle") {
    return "Lifecycle"
  }

  if (kind === "tool") {
    return "Tool call"
  }

  return "Working"
}
