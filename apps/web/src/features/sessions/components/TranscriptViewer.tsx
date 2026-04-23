import {
  CalendarBlankIcon,
  CaretDownIcon,
  ToolboxIcon,
} from "@phosphor-icons/react"
import { useMemo } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"
import { cn } from "@/lib/utils"

import { formatTimeOfDay } from "../lib/date-time"
import { formatSessionName, getProviderIcon } from "../lib/session-display"
import {
  type ParsedContentBlock,
  type ParsedMessage,
  parseTranscript,
} from "../lib/transcript-parser"

export interface TranscriptViewerSession {
  channel: string | null
  channelProvider: string | null
  chatType: string | null
  displayName: string | null
  endedAt: string | null
  estimatedCostUsd: string | null
  externalSessionId: string | null
  id: string
  inputTokens: number | null
  label: string | null
  lastSyncedAt: string | null
  messageCount: number | null
  model: string | null
  modelProvider: string | null
  originFrom: string | null
  runtimeMs: number | null
  sessionKey: string
  startedAt: string | null
  status: string
  subject: string | null
  totalTokens: number | null
  transcriptJsonl: string | null
}

export interface TranscriptViewerProps {
  channelNames: Record<string, string>
  cronTaskHref?: string | null
  currentUserExternalIds?: string[]
  dateTimePreferences: WorkspaceDateTimePreferences
  memberNames?: Record<string, string>
  orgSlug: string
  session: TranscriptViewerSession
}

interface MessageGroup {
  firstTimestamp: number | null
  id: string
  kind: "assistant" | "current_user" | "other_user" | "system_prompt"
  messages: ParsedMessage[]
  model: string | null
  senderId: string | null
  senderName: string | null
}

type ToolCallContentBlock = Extract<ParsedContentBlock, { type: "tool_call" }>
type ToolResultContentBlock = Extract<
  ParsedContentBlock,
  { type: "tool_result" }
>
type AssistantContentBlock = Exclude<ParsedContentBlock, ToolCallContentBlock>

type AssistantRenderItem =
  | {
      block: AssistantContentBlock
      key: string
      kind: "content"
    }
  | {
      call: ToolCallContentBlock
      key: string
      kind: "tool_exchange"
      result: ToolResultContentBlock | null
    }

function buildResolveText(
  memberNames: Record<string, string>,
  channelNames: Record<string, string>,
) {
  return (text: string) =>
    text
      .replace(/<@([A-Z0-9]+)(?:\|([^>]*))?>/gi, (_match, id, fallback) => {
        const name =
          memberNames[id] ?? memberNames[id?.toUpperCase()] ?? fallback

        return name ? `@${name}` : `@${id}`
      })
      .replace(/<#([A-Z0-9]+)(?:\|([^>]*))?>/gi, (_match, id, fallback) => {
        const name =
          channelNames[id] ?? channelNames[id?.toUpperCase()] ?? fallback

        return name ? `#${name}` : `#${id}`
      })
}

function groupMessagesIntoTurns(
  messages: ParsedMessage[],
  currentUserIdSet: Set<string>,
): Array<MessageGroup | { kind: "compaction"; msg: ParsedMessage }> {
  const groups: Array<
    MessageGroup | { kind: "compaction"; msg: ParsedMessage }
  > = []
  let currentGroup: MessageGroup | null = null

  for (const msg of messages) {
    if (msg.kind === "compaction") {
      if (currentGroup) {
        groups.push(currentGroup)
        currentGroup = null
      }

      groups.push({ kind: "compaction", msg })
      continue
    }

    const turnKind =
      msg.kind === "assistant" || msg.kind === "tool_result"
        ? "assistant"
        : msg.kind === "system_prompt"
          ? "system_prompt"
          : msg.senderId && currentUserIdSet.has(msg.senderId)
            ? "current_user"
            : "other_user"

    const matchesCurrent =
      currentGroup &&
      ((currentGroup.kind === "assistant" && turnKind === "assistant") ||
        (currentGroup.kind !== "assistant" &&
          turnKind !== "assistant" &&
          currentGroup.senderId === msg.senderId &&
          currentGroup.senderId !== null))

    if (matchesCurrent && currentGroup) {
      currentGroup.messages.push(msg)

      if (!currentGroup.model && msg.model) {
        currentGroup.model = msg.model
      }

      continue
    }

    if (currentGroup) {
      groups.push(currentGroup)
    }

    currentGroup = {
      firstTimestamp: msg.timestamp,
      id: `turn-${groups.length}-${msg.senderId ?? msg.kind}`,
      kind: turnKind,
      messages: [msg],
      model: msg.model,
      senderId: msg.senderId,
      senderName: turnKind === "assistant" ? "Otto" : msg.senderName,
    }
  }

  if (currentGroup) {
    groups.push(currentGroup)
  }

  return groups
}

function buildAssistantRenderItems(messages: ParsedMessage[]) {
  const items: AssistantRenderItem[] = []
  const toolExchangesByCallId = new Map<
    string,
    Extract<AssistantRenderItem, { kind: "tool_exchange" }>
  >()

  for (const message of messages) {
    for (const [blockIndex, block] of message.blocks.entries()) {
      const key = `${message.id}:${block.type}:${blockIndex}`

      if (block.type === "tool_call") {
        const item: AssistantRenderItem = {
          call: block,
          key,
          kind: "tool_exchange",
          result: null,
        }

        items.push(item)

        if (block.id) {
          toolExchangesByCallId.set(block.id, item)
        }

        continue
      }

      if (block.type === "tool_result" && block.toolCallId) {
        const exchange = toolExchangesByCallId.get(block.toolCallId)

        if (exchange && !exchange.result) {
          exchange.result = block
          continue
        }
      }

      items.push({
        block,
        key,
        kind: "content",
      })
    }
  }

  return items
}

function formatDuration(value: number | null) {
  if (value === null) return "-"
  if (value < 1000) return `${value}ms`
  const seconds = Math.round(value / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`
}

function formatTokens(value: number | null) {
  if (value === null) return "-"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function formatCost(value: string | null) {
  if (!value) return "-"
  const numberValue = Number.parseFloat(value)
  if (Number.isNaN(numberValue) || numberValue === 0) return "-"
  return `$${numberValue.toFixed(2)}`
}

function formatTimestamp(
  timestamp: number | null,
  dateTimePreferences: WorkspaceDateTimePreferences,
) {
  if (!timestamp) {
    return ""
  }

  return formatTimeOfDay(new Date(timestamp), dateTimePreferences, {
    includeSeconds: true,
  })
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-teal-500",
  ]
  let hash = 0

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index)
    hash |= 0
  }

  return colors[Math.abs(hash) % colors.length]
}

function TextBlock({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm text-foreground">
      {text}
    </div>
  )
}

function AudioTranscriptBlock({ text }: { text: string }) {
  return (
    <div className="border-l border-border/80 pl-3 text-xs leading-5 text-muted-foreground">
      <div className="mb-1 font-medium text-foreground/70">Transcript</div>
      <div className="whitespace-pre-wrap break-words">{text}</div>
    </div>
  )
}

function SenderAvatar({
  isOtto = false,
  name,
}: {
  isOtto?: boolean
  name: string | null
}) {
  const initial = (name ?? "?").charAt(0).toUpperCase()
  const color = isOtto ? "bg-primary" : getAvatarColor(name ?? "?")

  return (
    <Avatar className="size-7">
      <AvatarFallback className={cn("text-xs font-medium text-white", color)}>
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}

function formatToolPayload(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getRecordValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getToolCommandSubtitle(call: ToolCallContentBlock) {
  const input = getRecordValue(call.args)

  if (!input) {
    return null
  }

  const integrationKey = getStringValue(input.integrationKey)
  const commandKey =
    getStringValue(input.commandKey) ?? getStringValue(input.command)
  const commandPath = Array.isArray(input.commandPath)
    ? input.commandPath.filter((part) => typeof part === "string").join(".")
    : null
  const command = commandKey ?? commandPath

  if (integrationKey && command) {
    return `${integrationKey}.${command}`
  }

  return command ?? integrationKey
}

function ToolExchangeSection({
  children,
  label,
}: {
  children: string
  label: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-medium uppercase text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {children}
      </pre>
    </div>
  )
}

function ToolExchangeBlock({
  call,
  resolveText,
  result,
}: {
  call: ToolCallContentBlock
  resolveText: (text: string) => string
  result: ToolResultContentBlock | null
}) {
  const input = call.args !== undefined ? formatToolPayload(call.args) : null
  const output = result ? resolveText(result.content) : null
  const hasBody = input !== null || output !== null
  const subtitle = getToolCommandSubtitle(call)

  return (
    <Collapsible
      className="rounded-md border"
      data-tool-exchange-id={call.id ?? undefined}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-2.5 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <ToolboxIcon className="size-3.5 text-muted-foreground" />
          <span className="shrink-0 font-mono text-xs font-medium">
            {call.name}
          </span>
          {subtitle ? (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
          {result?.isError ? (
            <Badge className="px-1.5 py-0 text-[10px]" variant="destructive">
              Error
            </Badge>
          ) : null}
        </div>
        <CaretDownIcon className="size-3.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      {hasBody ? (
        <CollapsibleContent className="flex flex-col gap-3 border-t px-3 py-2">
          {input !== null ? (
            <ToolExchangeSection label="Input">{input}</ToolExchangeSection>
          ) : null}
          {output !== null ? (
            <ToolExchangeSection label="Output">{output}</ToolExchangeSection>
          ) : null}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  )
}

function ToolResultBlock({
  block,
  resolveText,
}: {
  block: ToolResultContentBlock
  resolveText: (text: string) => string
}) {
  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-2.5 text-sm">
        <div className="flex items-center gap-2">
          <ToolboxIcon className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-medium">
            {block.name ?? "Tool result"}
          </span>
          {block.isError ? (
            <Badge className="px-1.5 py-0 text-[10px]" variant="destructive">
              Error
            </Badge>
          ) : null}
        </div>
        <CaretDownIcon className="size-3.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-2">
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {resolveText(block.content)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

function TurnHeader({
  dateTimePreferences,
  group,
  resolveText,
}: {
  dateTimePreferences: WorkspaceDateTimePreferences
  group: MessageGroup
  resolveText: (text: string) => string
}) {
  const name = group.senderName
    ? resolveText(group.senderName)
    : group.kind === "assistant"
      ? "Otto"
      : group.kind === "system_prompt"
        ? "Scheduled Task"
        : "User"
  const timestamp = formatTimestamp(group.firstTimestamp, dateTimePreferences)

  if (group.kind === "system_prompt") {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
              S
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-foreground/70">{name}</span>
        </div>
        {timestamp ? (
          <span className="pl-9 text-xs text-muted-foreground">
            {timestamp}
          </span>
        ) : null}
      </div>
    )
  }

  if (group.kind === "current_user") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground/70">{name}</span>
          <SenderAvatar name={name} />
        </div>
        {timestamp ? (
          <span className="pr-9 text-xs text-muted-foreground">
            {timestamp}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <SenderAvatar isOtto={group.kind === "assistant"} name={name} />
        <span className="text-xs font-medium text-foreground/70">{name}</span>
        {group.kind === "assistant" && group.model ? (
          <Badge className="px-1.5 py-0 text-[10px]" variant="outline">
            {group.model}
          </Badge>
        ) : null}
      </div>
      {timestamp ? (
        <span className="pl-9 text-xs text-muted-foreground">{timestamp}</span>
      ) : null}
    </div>
  )
}

function StatsLine({ session }: { session: TranscriptViewerSession }) {
  const parts: string[] = []

  if (session.model) parts.push(session.model)
  if (session.totalTokens !== null)
    parts.push(`${formatTokens(session.totalTokens)} Tokens`)
  if (session.estimatedCostUsd) {
    const cost = formatCost(session.estimatedCostUsd)
    if (cost !== "-") parts.push(cost)
  }
  if (session.messageCount !== null) {
    parts.push(`${session.messageCount} messages`)
  }
  if (session.runtimeMs !== null) {
    const duration = formatDuration(session.runtimeMs)
    if (duration !== "-") parts.push(duration)
  }

  if (parts.length === 0) {
    return null
  }

  return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>
}

export function TranscriptViewer({
  channelNames = {},
  cronTaskHref,
  currentUserExternalIds = [],
  dateTimePreferences,
  memberNames = {},
  orgSlug: _orgSlug,
  session,
}: TranscriptViewerProps) {
  const messages = useMemo(
    () => parseTranscript(session.transcriptJsonl),
    [session.transcriptJsonl],
  )
  const currentUserIdSet = useMemo(
    () => new Set(currentUserExternalIds),
    [currentUserExternalIds],
  )
  const turns = useMemo(
    () => groupMessagesIntoTurns(messages, currentUserIdSet),
    [currentUserIdSet, messages],
  )
  const resolveText = useMemo(
    () => buildResolveText(memberNames, channelNames),
    [channelNames, memberNames],
  )
  const sessionName = useMemo(
    () =>
      formatSessionName({
        displayName: session.displayName,
        label: session.label,
        nameMaps: {
          channels: new Map(Object.entries(channelNames)),
          members: new Map(Object.entries(memberNames)),
        },
        originFrom: session.originFrom,
        sessionKey: session.sessionKey,
        subject: session.subject,
      }),
    [
      channelNames,
      memberNames,
      session.displayName,
      session.label,
      session.originFrom,
      session.sessionKey,
      session.subject,
    ],
  )
  const providerIcon = getProviderIcon(session.channel)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-start gap-3">
          {session.channel === "cron" ? (
            <CalendarBlankIcon className="size-5 shrink-0 text-muted-foreground" />
          ) : providerIcon ? (
            <img
              alt={session.channel ?? "channel"}
              className="size-5 shrink-0"
              src={providerIcon}
            />
          ) : null}
          <div className="flex flex-col gap-0.5">
            {cronTaskHref ? (
              <a
                className="text-xl font-semibold tracking-tight"
                href={cronTaskHref}
              >
                {resolveText(sessionName)}
              </a>
            ) : (
              <h1 className="text-xl font-semibold tracking-tight">
                {resolveText(sessionName)}
              </h1>
            )}
            <p className="font-mono text-xs text-muted-foreground">
              {session.sessionKey}
            </p>
            <StatsLine session={session} />
          </div>
        </div>

        <div className="flex flex-col gap-5 py-2">
          {turns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transcript data available.
            </p>
          ) : (
            turns.map((turn) => {
              if (turn.kind === "compaction") {
                const text =
                  turn.msg.blocks[0]?.type === "text"
                    ? turn.msg.blocks[0].text
                    : "Context compacted"

                return (
                  <div
                    className="flex items-center gap-3 py-2"
                    key={turn.msg.id}
                  >
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {text}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )
              }

              return (
                <div className="flex flex-col gap-2" key={turn.id}>
                  <TurnHeader
                    dateTimePreferences={dateTimePreferences}
                    group={turn}
                    resolveText={resolveText}
                  />
                  {turn.kind === "assistant" ? (
                    <div className="flex flex-col gap-3 pl-9">
                      {buildAssistantRenderItems(turn.messages).map((item) => {
                        if (item.kind === "tool_exchange") {
                          return (
                            <ToolExchangeBlock
                              call={item.call}
                              key={item.key}
                              resolveText={resolveText}
                              result={item.result}
                            />
                          )
                        }

                        if (item.block.type === "thinking") {
                          return (
                            <Collapsible
                              className="rounded-md border"
                              key={item.key}
                            >
                              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-2.5 text-sm">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Otto reasoning
                                </span>
                                <CaretDownIcon className="size-3.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="border-t px-3 py-2">
                                <TextBlock text={item.block.text} />
                              </CollapsibleContent>
                            </Collapsible>
                          )
                        }

                        if (item.block.type === "tool_result") {
                          return (
                            <ToolResultBlock
                              block={item.block}
                              key={item.key}
                              resolveText={resolveText}
                            />
                          )
                        }

                        if (item.block.type === "audio_transcript") {
                          return (
                            <AudioTranscriptBlock
                              key={item.key}
                              text={resolveText(item.block.text)}
                            />
                          )
                        }

                        return (
                          <TextBlock
                            key={item.key}
                            text={resolveText(item.block.text)}
                          />
                        )
                      })}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex flex-col gap-1.5 pl-9",
                        turn.kind === "current_user"
                          ? "items-end"
                          : "items-start",
                      )}
                    >
                      {turn.messages.map((message) => (
                        <div
                          className={cn(
                            "flex max-w-[85%] flex-col gap-2 rounded-lg px-3.5 py-2.5 text-sm",
                            turn.kind === "current_user"
                              ? "bg-secondary text-foreground"
                              : "bg-muted text-foreground",
                          )}
                          key={message.id}
                        >
                          {message.blocks.map((block, blockIndex) =>
                            block.type === "audio_transcript" ? (
                              <AudioTranscriptBlock
                                key={`${message.id}:audio-transcript:${blockIndex}`}
                                text={resolveText(block.text)}
                              />
                            ) : block.type === "text" ? (
                              <TextBlock
                                key={`${message.id}:text:${blockIndex}`}
                                text={resolveText(block.text)}
                              />
                            ) : null,
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
