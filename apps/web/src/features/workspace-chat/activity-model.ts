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

export type WorkspaceChatActivityPresentationKind =
  | "config"
  | "memory"
  | "read"
  | "search"
  | "skill"
  | "write"
  | (string & {})

export type WorkspaceChatActivityPresentationIconKey =
  | "linear"
  | "memory"
  | "skill"
  | (string & {})

export type WorkspaceChatActivityPresentationSource =
  | {
      kind: "integration_command"
      commandKey: string
      integrationKey: string
    }
  | {
      kind: "memory_file"
      memoryKind: "daily_note" | "workspace_memory"
      path: string
    }
  | {
      kind: "skill_document"
      documentKind: "details" | "skill"
      path: string
      skillKey: string
    }

export interface WorkspaceChatActivityPresentation {
  iconKey?: WorkspaceChatActivityPresentationIconKey
  kind: WorkspaceChatActivityPresentationKind
  source?: WorkspaceChatActivityPresentationSource
  title: string
}

export interface WorkspaceChatActivityEntry {
  events: WorkspaceChatMessageEvent[]
  firstSequence: number
  id: string
  itemId?: string
  kind: WorkspaceChatActivityEntryKind
  lastSequence: number
  presentation?: WorkspaceChatActivityPresentation
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
      const presentation = getActivityPresentation(messageEvent)
      entriesById.set(entryId, {
        events: [messageEvent],
        firstSequence: messageEvent.sequence,
        id: entryId,
        itemId: messageEvent.itemId,
        kind,
        lastSequence: messageEvent.sequence,
        presentation,
        status: messageEvent.status,
        summary: messageEvent.summary,
        title:
          presentation?.title ??
          messageEvent.title ??
          getFallbackTitle(kind),
        visibility: getActivityEntryVisibility(messageEvent, kind),
      })
      continue
    }

    existingEntry.events.push(messageEvent)
    const presentation = getActivityPresentation(messageEvent)
    existingEntry.lastSequence = messageEvent.sequence
    existingEntry.presentation = presentation ?? existingEntry.presentation
    existingEntry.status = messageEvent.status
    existingEntry.summary = messageEvent.summary ?? existingEntry.summary
    existingEntry.title =
      presentation?.title ?? messageEvent.title ?? existingEntry.title

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

function getActivityPresentation(
  messageEvent: WorkspaceChatMessageEvent,
): WorkspaceChatActivityPresentation | undefined {
  const explicitPresentation = getExplicitActivityPresentation(
    messageEvent.payload,
  )

  if (explicitPresentation) {
    return explicitPresentation
  }

  if (!messageEvent.title) {
    return undefined
  }

  return deriveInternalReadPresentation(messageEvent.title)
}

function getExplicitActivityPresentation(
  payload: WorkspaceChatMessageEvent["payload"],
): WorkspaceChatActivityPresentation | undefined {
  const activityPresentation = getRecordValue(payload.activityPresentation)

  if (!activityPresentation) {
    return undefined
  }

  const title = getStringValue(activityPresentation.title)
  const kind = getStringValue(activityPresentation.kind)

  if (!title || !kind) {
    return undefined
  }

  const presentation: WorkspaceChatActivityPresentation = {
    kind,
    title,
  }
  const iconKey = getStringValue(activityPresentation.iconKey)
  const source = getActivityPresentationSource(activityPresentation.source)

  if (iconKey) {
    presentation.iconKey = iconKey
  }

  if (source) {
    presentation.source = source
  }

  return presentation
}

function getActivityPresentationSource(
  value: unknown,
): WorkspaceChatActivityPresentationSource | undefined {
  const source = getRecordValue(value)

  if (!source) {
    return undefined
  }

  const kind = getStringValue(source.kind)

  if (kind === "integration_command") {
    const integrationKey = getStringValue(source.integrationKey)
    const commandKey = getStringValue(source.commandKey)

    if (integrationKey && commandKey) {
      return {
        commandKey,
        integrationKey,
        kind,
      }
    }
  }

  if (kind === "memory_file") {
    const memoryKind = getStringValue(source.memoryKind)
    const path = getStringValue(source.path)

    if (
      path &&
      (memoryKind === "daily_note" || memoryKind === "workspace_memory")
    ) {
      return {
        kind,
        memoryKind,
        path,
      }
    }
  }

  if (kind === "skill_document") {
    const documentKind = getStringValue(source.documentKind)
    const path = getStringValue(source.path)
    const skillKey = getStringValue(source.skillKey)

    if (
      path &&
      skillKey &&
      (documentKind === "details" || documentKind === "skill")
    ) {
      return {
        documentKind,
        kind,
        path,
        skillKey,
      }
    }
  }

  return undefined
}

function deriveInternalReadPresentation(
  title: string,
): WorkspaceChatActivityPresentation | undefined {
  const dailyMemoryMatch = title.match(
    /^read from (?<path>~\/\.openclaw\/workspace\/memory\/\d{4}-\d{2}-\d{2}\.md)$/,
  )

  if (dailyMemoryMatch?.groups?.path) {
    return {
      iconKey: "memory",
      kind: "memory",
      source: {
        kind: "memory_file",
        memoryKind: "daily_note",
        path: dailyMemoryMatch.groups.path,
      },
      title: "Checked daily memory note",
    }
  }

  const workspaceMemoryMatch = title.match(
    /^read from (?<path>~\/\.openclaw\/workspace\/MEMORY\.md)$/,
  )

  if (workspaceMemoryMatch?.groups?.path) {
    return {
      iconKey: "memory",
      kind: "memory",
      source: {
        kind: "memory_file",
        memoryKind: "workspace_memory",
        path: workspaceMemoryMatch.groups.path,
      },
      title: "Checked workspace memory guide",
    }
  }

  const skillDocumentMatch = title.match(
    /^read from (?<path>~\/\.openclaw\/workspace\/skills\/(?<skillKey>[^/]+)\/(?<documentKind>SKILL|DETAILS)\.md)$/,
  )

  if (skillDocumentMatch?.groups?.path && skillDocumentMatch.groups.skillKey) {
    const documentKind =
      skillDocumentMatch.groups.documentKind === "DETAILS"
        ? "details"
        : "skill"

    return {
      iconKey: "skill",
      kind: "skill",
      source: {
        documentKind,
        kind: "skill_document",
        path: skillDocumentMatch.groups.path,
        skillKey: skillDocumentMatch.groups.skillKey,
      },
      title:
        documentKind === "details"
          ? `Reviewed ${skillDocumentMatch.groups.skillKey} details`
          : `Reviewed ${skillDocumentMatch.groups.skillKey} instructions`,
    }
  }

  return undefined
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

function getRecordValue(
  value: unknown,
): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined
  }

  return value as Record<string, unknown>
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
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
