import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"

export type WorkspaceChatActivitySectionKind =
  | "approvals"
  | "system"
  | "thinking"
  | "work"

export type WorkspaceChatActivityEntryKind =
  | "approval"
  | "assistant_message"
  | "command_output"
  | "compaction"
  | "item"
  | "lifecycle"
  | "thinking"
  | "tool"

export type WorkspaceChatActivityEntryVisibility =
  | "debug"
  | "primary"
  | "secondary"

export interface WorkspaceChatActivityEntry {
  events: WorkspaceChatMessageEvent[]
  firstSequence: number
  id: string
  itemId?: string
  kind: WorkspaceChatActivityEntryKind
  lastSequence: number
  status: WorkspaceChatMessageEvent["status"]
  summary?: string
  title: string
  visibility: WorkspaceChatActivityEntryVisibility
}

export interface WorkspaceChatActivitySection {
  defaultExpanded: boolean
  entries: WorkspaceChatActivityEntry[]
  kind: WorkspaceChatActivitySectionKind
  status: WorkspaceChatMessageEvent["status"]
  title: string
}

export interface WorkspaceChatActivityModel {
  activeCount: number
  eventCount: number
  sections: WorkspaceChatActivitySection[]
  status: WorkspaceChatMessageEvent["status"]
}

const SECTION_ORDER: WorkspaceChatActivitySectionKind[] = [
  "work",
  "approvals",
  "thinking",
  "system",
]

export function buildWorkspaceChatActivityModel(
  messageEvents: WorkspaceChatMessageEvent[],
): WorkspaceChatActivityModel {
  const sortedEvents = [...messageEvents].sort(
    (left, right) => left.sequence - right.sequence,
  )
  const entriesById = new Map<string, WorkspaceChatActivityEntry>()

  for (const messageEvent of sortedEvents) {
    const kind = getActivityEntryKind(messageEvent)
    const entryId = getActivityEntryId(messageEvent, kind)
    const existingEntry = entriesById.get(entryId)

    if (!existingEntry) {
      entriesById.set(entryId, {
        events: [messageEvent],
        firstSequence: messageEvent.sequence,
        id: entryId,
        itemId: messageEvent.itemId,
        kind,
        lastSequence: messageEvent.sequence,
        status: messageEvent.status,
        summary: messageEvent.summary,
        title: messageEvent.title ?? getFallbackTitle(kind),
        visibility: getActivityEntryVisibility(messageEvent, kind),
      })
      continue
    }

    existingEntry.events.push(messageEvent)
    existingEntry.lastSequence = messageEvent.sequence
    existingEntry.status = messageEvent.status
    existingEntry.summary = messageEvent.summary ?? existingEntry.summary
    existingEntry.title = messageEvent.title ?? existingEntry.title

    if (!existingEntry.itemId && messageEvent.itemId) {
      existingEntry.itemId = messageEvent.itemId
    }
  }

  const entries = [...entriesById.values()].sort(
    (left, right) => left.firstSequence - right.firstSequence,
  )
  const sections = SECTION_ORDER.flatMap((sectionKind) => {
    const sectionEntries = entries.filter(
      (entry) => getActivitySectionKind(entry.kind) === sectionKind,
    )

    if (sectionEntries.length === 0) {
      return []
    }

    return [
      {
        defaultExpanded: sectionKind !== "system",
        entries: sectionEntries,
        kind: sectionKind,
        status: getAggregateStatus(sectionEntries.map((entry) => entry.status)),
        title: getSectionTitle(sectionKind),
      },
    ]
  })

  const lifecycleEntry = entriesById.get("lifecycle")
  const visibleEntries = entries.filter((entry) => entry.visibility !== "debug")

  return {
    activeCount: visibleEntries.filter((entry) =>
      isActiveStatus(entry.status),
    ).length,
    eventCount: sortedEvents.length,
    sections,
    status:
      lifecycleEntry?.status ??
      getAggregateStatus(entries.map((entry) => entry.status)),
  }
}

function getActivityEntryKind(
  messageEvent: WorkspaceChatMessageEvent,
): WorkspaceChatActivityEntryKind {
  const prefix = messageEvent.type.split(".")[0]

  if (
    prefix === "approval" ||
    prefix === "assistant_message" ||
    prefix === "command_output" ||
    prefix === "compaction" ||
    prefix === "item" ||
    prefix === "lifecycle" ||
    prefix === "thinking" ||
    prefix === "tool"
  ) {
    return prefix
  }

  return "item"
}

function getActivityEntryId(
  messageEvent: WorkspaceChatMessageEvent,
  kind: WorkspaceChatActivityEntryKind,
) {
  if (
    kind === "assistant_message" ||
    kind === "compaction" ||
    kind === "lifecycle" ||
    kind === "thinking"
  ) {
    return kind
  }

  if (messageEvent.itemId) {
    return `${kind}:${messageEvent.itemId}`
  }

  return `${kind}:${messageEvent.id}`
}

function getActivityEntryVisibility(
  messageEvent: WorkspaceChatMessageEvent,
  kind: WorkspaceChatActivityEntryKind,
): WorkspaceChatActivityEntryVisibility {
  if (
    kind === "assistant_message" ||
    kind === "compaction" ||
    (kind === "tool" && !messageEvent.itemId)
  ) {
    return "debug"
  }

  if (kind === "command_output" || kind === "thinking") {
    return "secondary"
  }

  return "primary"
}

function getActivitySectionKind(
  kind: WorkspaceChatActivityEntryKind,
): WorkspaceChatActivitySectionKind {
  if (kind === "approval") {
    return "approvals"
  }

  if (kind === "thinking") {
    return "thinking"
  }

  if (
    kind === "assistant_message" ||
    kind === "compaction" ||
    kind === "lifecycle"
  ) {
    return "system"
  }

  return "work"
}

function getSectionTitle(kind: WorkspaceChatActivitySectionKind) {
  if (kind === "approvals") {
    return "Approvals"
  }

  if (kind === "thinking") {
    return "Thinking"
  }

  if (kind === "system") {
    return "System"
  }

  return "Work"
}

function getFallbackTitle(kind: WorkspaceChatActivityEntryKind) {
  if (kind === "approval") {
    return "Approval"
  }

  if (kind === "assistant_message") {
    return "Assistant message"
  }

  if (kind === "command_output") {
    return "Command output"
  }

  if (kind === "compaction") {
    return "Context compaction"
  }

  if (kind === "lifecycle") {
    return "Lifecycle"
  }

  if (kind === "thinking") {
    return "Thinking"
  }

  if (kind === "tool") {
    return "Tool call"
  }

  return "Working"
}

function getAggregateStatus(
  statuses: Array<WorkspaceChatMessageEvent["status"]>,
): WorkspaceChatMessageEvent["status"] {
  if (statuses.some((status) => status === "running")) {
    return "running"
  }

  if (statuses.some((status) => status === "pending")) {
    return "pending"
  }

  if (statuses.some((status) => status === "blocked")) {
    return "blocked"
  }

  if (statuses.some((status) => status === "failed")) {
    return "failed"
  }

  if (statuses.some((status) => status === "denied")) {
    return "denied"
  }

  if (statuses.some((status) => status === "approved")) {
    return "approved"
  }

  if (statuses.some((status) => status === "unavailable")) {
    return "unavailable"
  }

  return "completed"
}

function isActiveStatus(status: WorkspaceChatMessageEvent["status"]) {
  return status === "blocked" || status === "pending" || status === "running"
}
