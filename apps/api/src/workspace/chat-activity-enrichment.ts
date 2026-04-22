import {
  collectCommands,
  getIntegrationDefinition,
} from "@otto/feature-integrations-runtime/integrations/framework"
import type { WorkspaceChatMessageEvent } from "@otto/feature-workspace-chat"

type ParsedToolCall = {
  args: Record<string, unknown>
  name: string
}

type EnrichedActivityPresentation = {
  iconKey?: string
  kind: string
  source?: {
    commandKey: string
    integrationKey: string
    kind: "integration_command"
  }
  title: string
}

const GENERIC_INTEGRATION_TOOL_NAMES = new Set([
  "execute_integration_command",
  "find_integration_commands",
  "get_integration_details",
])

const TOOL_CALL_BLOCK_TYPES = new Set([
  "tool_call",
  "toolCall",
  "tool_use",
  "toolUse",
])

const IDENTIFIER_KEYS = [
  "commentId",
  "customerId",
  "documentId",
  "id",
  "initiativeId",
  "issueId",
  "issueKey",
  "key",
  "projectId",
  "teamId",
  "userId",
] as const

export function enrichWorkspaceChatMessageEventsWithTranscripts(input: {
  events: WorkspaceChatMessageEvent[]
  transcriptJsonlBySessionKey: Map<string, string | null>
}) {
  const toolCallsBySessionKey = new Map<string, Map<string, ParsedToolCall>>()

  for (const [
    sessionKey,
    transcriptJsonl,
  ] of input.transcriptJsonlBySessionKey) {
    if (!transcriptJsonl?.trim()) {
      continue
    }

    const toolCalls = parseTranscriptToolCalls(transcriptJsonl)

    if (toolCalls.size > 0) {
      toolCallsBySessionKey.set(sessionKey, toolCalls)
    }
  }

  return input.events.map((event) => {
    if (hasExplicitActivityPresentation(event.payload)) {
      return event
    }

    const genericToolName = getGenericIntegrationToolName(event)

    if (!genericToolName || !event.sessionKey) {
      return event
    }

    const toolCalls = toolCallsBySessionKey.get(event.sessionKey)

    if (!toolCalls) {
      return event
    }

    const toolCallId = resolveEventToolCallId(event)

    if (!toolCallId) {
      return event
    }

    const toolCall = toolCalls.get(toolCallId)

    if (!toolCall) {
      return event
    }

    const enriched =
      toolCall.name === "execute_integration_command"
        ? deriveExecuteIntegrationCommandEnrichment(toolCall.args)
        : toolCall.name === "find_integration_commands"
          ? deriveFindIntegrationCommandsEnrichment(toolCall.args)
          : toolCall.name === "get_integration_details"
            ? deriveGetIntegrationDetailsEnrichment(toolCall.args)
            : null

    if (!enriched) {
      return event
    }

    const payload = {
      ...event.payload,
      activityPresentation: enriched.presentation,
    }

    const summary =
      shouldReplaceSummary(event.summary, genericToolName) && enriched.summary
        ? enriched.summary
        : event.summary

    return {
      ...event,
      payload,
      summary,
      title: enriched.presentation.title,
    }
  })
}

function parseTranscriptToolCalls(jsonl: string) {
  const toolCalls = new Map<string, ParsedToolCall>()

  for (const rawLine of jsonl.split("\n")) {
    const line = rawLine.trim()

    if (!line) {
      continue
    }

    let parsed: Record<string, unknown>

    try {
      parsed = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }

    if (parsed.type !== "message") {
      continue
    }

    const message = asRecord(parsed.message)

    if (!message || message.role !== "assistant") {
      continue
    }

    const content = Array.isArray(message.content) ? message.content : null

    if (!content) {
      continue
    }

    for (const block of content) {
      const record = asRecord(block)

      if (
        !record ||
        !TOOL_CALL_BLOCK_TYPES.has(readString(record.type) ?? "")
      ) {
        continue
      }

      const id = normalizeToolCallId(
        readString(record.id) ??
          readString(record.tool_use_id) ??
          readString(record.toolUseId),
      )
      const name =
        readString(record.name) ?? readString(record.function) ?? undefined

      if (!id || !name) {
        continue
      }

      toolCalls.set(id, {
        args:
          asRecord(record.arguments) ??
          asRecord(record.args) ??
          asRecord(record.input) ??
          {},
        name,
      })
    }
  }

  return toolCalls
}

function deriveExecuteIntegrationCommandEnrichment(
  args: Record<string, unknown>,
) {
  const integrationKey = readString(args.integrationKey)?.toLowerCase()
  const commandKey = resolveCommandKey(args)
  const commandArguments =
    asRecord(args.arguments) ?? asRecord(args.params) ?? {}

  if (!integrationKey || !commandKey) {
    return null
  }

  const integration = getIntegrationDefinition(integrationKey)
  const command = integration?.runtimeSurface
    ? (collectCommands(integration.runtimeSurface).find(
        (entry) => entry.commandKey === commandKey,
      ) ?? null)
    : null

  const basePresentation = buildCommandPresentationBase({
    command,
    commandKey,
    integrationKey,
  })
  const title = appendCommandArgumentContext(
    basePresentation.title,
    commandArguments,
  )
  const summary = buildCommandSummary(commandArguments)

  return {
    presentation: {
      ...basePresentation,
      title,
    },
    summary,
  }
}

function deriveFindIntegrationCommandsEnrichment(
  args: Record<string, unknown>,
) {
  const query = readString(args.query)
  const title = query
    ? `Find integration commands for "${query}"`
    : "Find integration commands"

  return {
    presentation: {
      kind: "search",
      title,
    } satisfies EnrichedActivityPresentation,
    summary: query ? `Looking for commands matching "${query}"` : undefined,
  }
}

function deriveGetIntegrationDetailsEnrichment(args: Record<string, unknown>) {
  const integrationKey = readString(args.integrationKey)?.toLowerCase()
  const detailType = readString(args.detailType)

  if (!integrationKey || !detailType) {
    return null
  }

  const integration = getIntegrationDefinition(integrationKey)
  const integrationLabel =
    integration?.label ?? humanizeCommandKey(integrationKey)

  if (detailType === "command") {
    const commandKey =
      readString(args.commandKey) ?? resolvePathKey(args.commandPath)

    if (!commandKey) {
      return {
        presentation: {
          kind: "read",
          source: {
            commandKey: "details",
            integrationKey,
            kind: "integration_command",
          },
          title: `Reviewed ${integrationLabel} command details`,
        } satisfies EnrichedActivityPresentation,
        summary: undefined,
      }
    }

    const command = integration?.runtimeSurface
      ? (collectCommands(integration.runtimeSurface).find(
          (entry) => entry.commandKey === commandKey,
        ) ?? null)
      : null
    const label =
      command?.activityPresentation?.title ??
      command?.label ??
      humanizeCommandKey(commandKey)

    return {
      presentation: {
        kind: "read",
        source: {
          commandKey,
          integrationKey,
          kind: "integration_command",
        },
        title: `Reviewed ${label} details`,
      } satisfies EnrichedActivityPresentation,
      summary: undefined,
    }
  }

  if (detailType === "command_group") {
    const groupPath = readStringArray(args.groupPath)
    const groupLabel = findIntegrationGroupLabel({
      groupPath,
      integration,
    })

    return {
      presentation: {
        kind: "read",
        source: {
          commandKey: groupPath?.join(".") ?? "group",
          integrationKey,
          kind: "integration_command",
        },
        title: groupLabel
          ? `Reviewed ${groupLabel} commands`
          : `Reviewed ${integrationLabel} command group`,
      } satisfies EnrichedActivityPresentation,
      summary: undefined,
    }
  }

  return null
}

function buildCommandPresentationBase(input: {
  command: ReturnType<typeof collectCommands>[number] | null
  commandKey: string
  integrationKey: string
}): EnrichedActivityPresentation {
  if (input.command?.activityPresentation) {
    return {
      ...input.command.activityPresentation,
      source: {
        commandKey: input.command.commandKey,
        integrationKey: input.integrationKey,
        kind: "integration_command",
      },
    }
  }

  return {
    kind: inferPresentationKind(input.commandKey),
    title: input.command?.label ?? humanizeCommandKey(input.commandKey),
    source: {
      commandKey: input.commandKey,
      integrationKey: input.integrationKey,
      kind: "integration_command",
    },
  }
}

function appendCommandArgumentContext(
  baseTitle: string,
  args: Record<string, unknown>,
) {
  const query = readString(args.query)

  if (query) {
    return `${baseTitle} for "${query}"`
  }

  const identifier = readFirstStringLike(args, IDENTIFIER_KEYS)

  if (identifier) {
    return `${baseTitle} ${identifier}`
  }

  return baseTitle
}

function buildCommandSummary(args: Record<string, unknown>) {
  const query = readString(args.query)

  if (query) {
    return `Query: ${query}`
  }

  const identifier = readFirstStringLike(args, IDENTIFIER_KEYS)

  if (identifier) {
    return `Target: ${identifier}`
  }

  return undefined
}

function resolveCommandKey(args: Record<string, unknown>) {
  const commandKey = readString(args.commandKey)

  if (commandKey) {
    return commandKey
  }

  if (!Array.isArray(args.commandPath)) {
    return undefined
  }

  const parts = args.commandPath
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)

  return parts.length > 0 ? parts.join(".") : undefined
}

function resolvePathKey(value: unknown) {
  const parts = readStringArray(value)
  return parts?.length ? parts.join(".") : undefined
}

function resolveEventToolCallId(event: WorkspaceChatMessageEvent) {
  return (
    normalizeToolCallId(readString(asRecord(event.payload)?.toolCallId)) ??
    normalizeToolCallId(readString(asRecord(event.payload)?.itemId)) ??
    normalizeToolCallId(event.itemId)
  )
}

function getGenericIntegrationToolName(event: WorkspaceChatMessageEvent) {
  const payload = asRecord(event.payload)
  const candidates = [readString(payload?.name), event.title]

  for (const candidate of candidates) {
    const normalized = candidate?.trim().toLowerCase()

    if (normalized && GENERIC_INTEGRATION_TOOL_NAMES.has(normalized)) {
      return normalized
    }
  }

  return undefined
}

function hasExplicitActivityPresentation(payload: Record<string, unknown>) {
  return Boolean(asRecord(payload.activityPresentation))
}

function shouldReplaceSummary(
  summary: string | undefined,
  genericToolName: string,
) {
  if (!summary?.trim()) {
    return true
  }

  return summary.trim().toLowerCase() === genericToolName
}

function normalizeToolCallId(value: string | null | undefined) {
  if (!value?.trim()) {
    return undefined
  }

  let normalized = value.trim()

  if (normalized.startsWith("tool:")) {
    normalized = normalized.slice("tool:".length)
  } else if (normalized.startsWith("command:")) {
    normalized = normalized.slice("command:".length)
  }

  const primary = normalized.split("|")[0]?.trim()
  return primary || undefined
}

function inferPresentationKind(
  commandKey: string,
): EnrichedActivityPresentation["kind"] {
  const action = commandKey.split(".").at(-1)?.trim().toLowerCase()

  if (action === "search" || action === "list") {
    return "search"
  }

  if (
    action === "create" ||
    action === "update" ||
    action === "delete" ||
    action === "archive" ||
    action === "unarchive"
  ) {
    return "write"
  }

  return "read"
}

function humanizeCommandKey(commandKey: string) {
  return commandKey
    .split(".")
    .map((part) =>
      part
        .split(/[_-]+/)
        .filter(Boolean)
        .map((entry) => `${entry.at(0)?.toUpperCase() ?? ""}${entry.slice(1)}`)
        .join(" "),
    )
    .join(" ")
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const parts = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)

  return parts.length > 0 ? parts : undefined
}

function findIntegrationGroupLabel(input: {
  groupPath?: string[]
  integration: ReturnType<typeof getIntegrationDefinition> | null | undefined
}) {
  if (!input.groupPath?.length || !input.integration?.runtimeSurface) {
    return undefined
  }

  let currentGroups = input.integration.runtimeSurface.commandGroups
  let currentLabel: string | undefined

  for (const segment of input.groupPath) {
    const group = currentGroups.find((entry) => entry.groupKey === segment)

    if (!group) {
      return currentLabel
    }

    currentLabel = group.label
    currentGroups = group.childGroups ?? []
  }

  return currentLabel
}

function readFirstStringLike(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }

  return undefined
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
