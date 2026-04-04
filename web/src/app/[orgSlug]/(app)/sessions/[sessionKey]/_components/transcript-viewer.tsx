"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

import {
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { useSetBreadcrumbs } from "@/components/breadcrumb-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, WrenchIcon } from "lucide-react";

import {
  parseTranscript,
  type ParsedContentBlock,
  type ParsedMessage,
} from "./transcript-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Session = {
  sessionKey: string;
  externalSessionId: string | null;
  displayName: string | null;
  label: string | null;
  subject: string | null;
  channel: string | null;
  channelProvider: string | null;
  chatType: string | null;
  originFrom: string | null;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  runtimeMs: number | null;
  model: string | null;
  modelProvider: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: string | null;
  messageCount: number | null;
  transcriptJsonl: string | null;
  lastSyncedAt: Date;
};

type TurnKind = "assistant" | "current_user" | "other_user" | "system_prompt";

type MessageGroup = {
  id: string;
  kind: TurnKind;
  senderName: string | null;
  senderId: string | null;
  firstTimestamp: number | null;
  model: string | null;
  messages: ParsedMessage[];
};

// ---------------------------------------------------------------------------
// Slack mention resolution context
// ---------------------------------------------------------------------------

type ResolveTextFn = (text: string) => string;

const ResolveTextContext = createContext<ResolveTextFn>((t) => t);

function useResolveText() {
  return useContext(ResolveTextContext);
}

function buildResolveText(
  memberNames: Record<string, string>,
  channelNames: Record<string, string>,
): ResolveTextFn {
  return (text: string) => {
    return text
      .replace(/<@([A-Z0-9]+)(?:\|([^>]*))?>/gi, (_match, id, fallback) => {
        const name =
          memberNames[id] ?? memberNames[id?.toUpperCase()] ?? fallback;
        return name ? `@${name}` : `@${id}`;
      })
      .replace(/<#([A-Z0-9]+)(?:\|([^>]*))?>/gi, (_match, id, fallback) => {
        const name =
          channelNames[id] ?? channelNames[id?.toUpperCase()] ?? fallback;
        return name ? `#${name}` : `#${id}`;
      });
  };
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

function groupMessagesIntoTurns(
  messages: ParsedMessage[],
  currentUserIdSet: Set<string>,
): (MessageGroup | { kind: "compaction"; msg: ParsedMessage })[] {
  const groups: (MessageGroup | { kind: "compaction"; msg: ParsedMessage })[] =
    [];
  let currentGroup: MessageGroup | null = null;

  for (const msg of messages) {
    if (msg.kind === "compaction") {
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
      groups.push({ kind: "compaction", msg });
      continue;
    }

    const turnKind: TurnKind =
      msg.kind === "assistant" || msg.kind === "tool_result"
        ? "assistant"
        : msg.kind === "system_prompt"
          ? "system_prompt"
          : msg.senderId && currentUserIdSet.has(msg.senderId)
            ? "current_user"
            : "other_user";

    const turnKey =
      turnKind === "assistant"
        ? "assistant"
        : msg.senderId ?? msg.senderName ?? "unknown";

    const matchesCurrent =
      currentGroup &&
      ((currentGroup.kind === "assistant" && turnKind === "assistant") ||
        (currentGroup.kind !== "assistant" &&
          turnKind !== "assistant" &&
          currentGroup.senderId === msg.senderId &&
          currentGroup.senderId !== null));

    if (matchesCurrent && currentGroup) {
      currentGroup.messages.push(msg);
      if (!currentGroup.model && msg.model) {
        currentGroup.model = msg.model;
      }
    } else {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        id: `turn-${groups.length}-${turnKey}`,
        kind: turnKind,
        senderName: turnKind === "assistant" ? "Otto" : msg.senderName,
        senderId: msg.senderId,
        firstTimestamp: msg.timestamp,
        model: msg.model,
        messages: [msg],
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function formatTokens(n: number | null): string {
  if (n === null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(v: string | null): string {
  if (!v) return "-";
  const n = parseFloat(v);
  if (Number.isNaN(n) || n === 0) return "-";
  return `$${n.toFixed(2)}`;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

// ---------------------------------------------------------------------------
// Channel icon
// ---------------------------------------------------------------------------

const providerIcons: Record<string, string> = {
  slack: "/integrations/slack.svg",
  whatsapp: "/integrations/whatsapp.png",
};

function ChannelIcon({ channel }: { channel: string | null }) {
  if (channel === "cron") {
    return (
      <HugeiconsIcon
        icon={Calendar03Icon}
        className="size-5 shrink-0 text-muted-foreground"
      />
    );
  }
  const icon = channel ? providerIcons[channel] : null;
  if (!icon) return null;
  return (
    <Image
      alt={channel ?? ""}
      className="size-5 shrink-0"
      height={20}
      src={icon}
      width={20}
    />
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function SenderAvatar({
  name,
  isOtto,
}: {
  name: string | null;
  isOtto?: boolean;
}) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  const color = isOtto ? "bg-primary" : getAvatarColor(name ?? "?");

  return (
    <Avatar className="size-7">
      <AvatarFallback
        className={cn("text-xs font-medium text-white", color)}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

// ---------------------------------------------------------------------------
// Turn renderers
// ---------------------------------------------------------------------------

function TurnHeader({ group }: { group: MessageGroup }) {
  const resolveText = useResolveText();
  const name = group.senderName
    ? resolveText(group.senderName)
    : group.kind === "assistant"
      ? "Otto"
      : group.kind === "system_prompt"
        ? "Scheduled Task"
        : "User";
  const ts = formatTimestamp(group.firstTimestamp);

  if (group.kind === "system_prompt") {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <SenderAvatar name={name} />
          <span className="text-xs font-medium text-foreground/70">{name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            System
          </Badge>
        </div>
        {ts ? (
          <span className="text-xs text-muted-foreground pl-9">{ts}</span>
        ) : null}
      </div>
    );
  }

  if (group.kind === "current_user") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground/70">{name}</span>
          <SenderAvatar name={name} />
        </div>
        {ts ? (
          <span className="text-xs text-muted-foreground pr-9">{ts}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <SenderAvatar name={name} isOtto={group.kind === "assistant"} />
        <span className="text-xs font-medium text-foreground/70">{name}</span>
        {group.kind === "assistant" && group.model ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {group.model}
          </Badge>
        ) : null}
      </div>
      {ts ? (
        <span className="text-xs text-muted-foreground pl-9">{ts}</span>
      ) : null}
    </div>
  );
}

function AssistantTurnMessages({ messages }: { messages: ParsedMessage[] }) {
  const resolveText = useResolveText();

  return (
    <div className="flex flex-col gap-3 pl-9">
      {messages.map((msg) => {
        if (msg.kind === "tool_result") {
          return <ToolResultBlock key={msg.id} msg={msg} />;
        }

        const thinkingBlocks = msg.blocks.filter(
          (b): b is ParsedContentBlock & { type: "thinking" } =>
            b.type === "thinking",
        );
        const textBlocks = msg.blocks.filter(
          (b): b is ParsedContentBlock & { type: "text" } =>
            b.type === "text",
        );
        const toolCallBlocks = msg.blocks.filter(
          (b): b is ParsedContentBlock & { type: "tool_call" } =>
            b.type === "tool_call",
        );

        return (
          <div key={msg.id} className="flex flex-col gap-2">
            {thinkingBlocks.map((block, i) => (
              <Reasoning key={`thinking-${i}`} defaultOpen={false}>
                <ReasoningTrigger />
                <ReasoningContent>{block.text}</ReasoningContent>
              </Reasoning>
            ))}
            {textBlocks.map((block, i) => (
              <div
                key={`text-${i}`}
                className="text-sm text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              >
                <MessageResponse>{resolveText(block.text)}</MessageResponse>
              </div>
            ))}
            {toolCallBlocks.map((block, i) => (
              <ToolCallBlock key={`tool-${i}`} block={block} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function UserTurnMessages({
  messages,
  isCurrentUser,
}: {
  messages: ParsedMessage[];
  isCurrentUser: boolean;
}) {
  const resolveText = useResolveText();

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        isCurrentUser ? "items-end pl-9" : "items-start pl-9",
      )}
    >
      {messages.map((msg) => {
        const textBlock = msg.blocks.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") return null;

        return (
          <div
            key={msg.id}
            className={cn(
              "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm [&_ul]:pl-5 [&_ol]:pl-5",
              isCurrentUser
                ? "bg-secondary text-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <MessageResponse>{resolveText(textBlock.text)}</MessageResponse>
          </div>
        );
      })}
    </div>
  );
}

function SystemPromptMessages({ messages }: { messages: ParsedMessage[] }) {
  const resolveText = useResolveText();

  return (
    <div className="flex flex-col gap-1.5 items-start pl-9">
      {messages.map((msg) => {
        const textBlock = msg.blocks.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") return null;

        return (
          <Collapsible key={msg.id} className="w-full max-w-[85%]">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-amber-500/10">
              <span className="truncate">Task prompt</span>
              <ChevronDownIcon className="size-3.5 shrink-0 transition-transform [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="rounded-b-lg border border-t-0 border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-sm text-muted-foreground [&_ul]:pl-5 [&_ol]:pl-5">
              <MessageResponse>{resolveText(textBlock.text)}</MessageResponse>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function ToolCallBlock({
  block,
}: {
  block: ParsedContentBlock & { type: "tool_call" };
}) {
  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-2.5 text-sm">
        <div className="flex items-center gap-2">
          <WrenchIcon className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-medium">{block.name}</span>
        </div>
        <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      {block.args !== undefined ? (
        <CollapsibleContent className="border-t px-3 py-2">
          <pre className="overflow-x-auto text-xs text-muted-foreground">
            {typeof block.args === "string"
              ? block.args
              : JSON.stringify(block.args, null, 2)}
          </pre>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

function ToolResultBlock({ msg }: { msg: ParsedMessage }) {
  const resolveText = useResolveText();
  const resultBlock = msg.blocks.find((b) => b.type === "tool_result") as
    | (ParsedContentBlock & { type: "tool_result" })
    | undefined;

  if (!resultBlock) return null;

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-2.5 text-sm">
        <div className="flex items-center gap-2">
          <WrenchIcon className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-medium">
            {resultBlock.name ?? "Tool result"}
          </span>
          {resultBlock.isError ? (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0"
            >
              Error
            </Badge>
          ) : null}
        </div>
        <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-2">
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {resolveText(resultBlock.content)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CompactionDivider({ msg }: { msg: ParsedMessage }) {
  const text =
    msg.blocks[0]?.type === "text" ? msg.blocks[0].text : "Context compacted";
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{text}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats line
// ---------------------------------------------------------------------------

function StatsLine({ session }: { session: Session }) {
  const parts: string[] = [];
  if (session.model) parts.push(session.model);
  if (session.totalTokens !== null)
    parts.push(`${formatTokens(session.totalTokens)} Tokens`);
  if (session.estimatedCostUsd) {
    const cost = formatCost(session.estimatedCostUsd);
    if (cost !== "-") parts.push(cost);
  }
  if (session.messageCount !== null)
    parts.push(`${session.messageCount} messages`);
  if (session.runtimeMs !== null) {
    const dur = formatDuration(session.runtimeMs);
    if (dur !== "-") parts.push(dur);
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {parts.join(" · ")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TranscriptViewer({
  orgSlug,
  session,
  sessionName,
  currentUserExternalIds = [],
  memberNames = {},
  channelNames = {},
}: {
  orgSlug: string;
  session: Session;
  sessionName: string;
  currentUserExternalIds?: string[];
  memberNames?: Record<string, string>;
  channelNames?: Record<string, string>;
}) {
  const setBreadcrumbs = useSetBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: "Sessions", href: `/${orgSlug}/sessions` },
      { label: sessionName },
    ]);
    return () => setBreadcrumbs([]);
  }, [orgSlug, sessionName, setBreadcrumbs]);

  const messages = useMemo(
    () => parseTranscript(session.transcriptJsonl),
    [session.transcriptJsonl],
  );

  const currentUserIdSet = useMemo(
    () => new Set(currentUserExternalIds),
    [currentUserExternalIds],
  );

  const turns = useMemo(
    () => groupMessagesIntoTurns(messages, currentUserIdSet),
    [messages, currentUserIdSet],
  );

  const resolveText = useCallback(
    buildResolveText(memberNames, channelNames),
    [memberNames, channelNames],
  );

  const title =
    session.displayName ||
    session.label ||
    session.subject ||
    session.sessionKey;

  return (
    <ResolveTextContext.Provider value={resolveText}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl">
          {/* Header with channel icon */}
          <div className="flex items-start gap-3 pb-6">
            <ChannelIcon channel={session.channel} />
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl font-semibold tracking-tight">
                {resolveText(title)}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {session.sessionKey}
              </p>
              <StatsLine session={session} />
            </div>
          </div>

          {/* Transcript */}
          <div className="flex flex-col gap-5 py-4">
            {turns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transcript data available.
              </p>
            ) : (
              turns.map((turn) => {
                if (turn.kind === "compaction") {
                  return (
                    <CompactionDivider key={turn.msg.id} msg={turn.msg} />
                  );
                }

                const group = turn as MessageGroup;

                return (
                  <div key={group.id} className="flex flex-col gap-2">
                    <TurnHeader group={group} />
                    {group.kind === "assistant" ? (
                      <AssistantTurnMessages messages={group.messages} />
                    ) : group.kind === "system_prompt" ? (
                      <SystemPromptMessages messages={group.messages} />
                    ) : (
                      <UserTurnMessages
                        messages={group.messages}
                        isCurrentUser={group.kind === "current_user"}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ResolveTextContext.Provider>
  );
}
