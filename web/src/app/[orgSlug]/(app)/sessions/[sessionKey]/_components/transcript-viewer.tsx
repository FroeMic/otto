"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { createContext, useCallback, useContext, useMemo } from "react";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
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

// ---------------------------------------------------------------------------
// Slack mention resolution context
// ---------------------------------------------------------------------------

type ResolveTextFn = (text: string) => string;

const ResolveTextContext = createContext<ResolveTextFn>((t) => t);

function useResolveText() {
  return useContext(ResolveTextContext);
}

/**
 * Resolve Slack-style mention tags in text:
 *   <@U0AL9B039A7> → @displayName
 *   <#C0AKY040D3M> → #channel-name
 *   <#C0AKY040D3M|channel-name> → #channel-name
 */
function buildResolveText(
  memberNames: Record<string, string>,
  channelNames: Record<string, string>,
): ResolveTextFn {
  return (text: string) => {
    return text
      // User mentions: <@U0AL9B039A7> or <@U0AL9B039A7|display_name>
      .replace(/<@([A-Z0-9]+)(?:\|([^>]*))?>/gi, (_match, id, fallback) => {
        const name =
          memberNames[id] ??
          memberNames[id?.toUpperCase()] ??
          fallback;
        return name ? `@${name}` : `@${id}`;
      })
      // Channel mentions: <#C0AKY040D3M> or <#C0AKY040D3M|channel-name>
      .replace(/<#([A-Z0-9]+)(?:\|([^>]*))?>/gi, (_match, id, fallback) => {
        const name =
          channelNames[id] ??
          channelNames[id?.toUpperCase()] ??
          fallback;
        return name ? `#${name}` : `#${id}`;
      });
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  running: "default",
  done: "secondary",
  failed: "destructive",
  killed: "destructive",
  timeout: "destructive",
};

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
  return `$${n.toFixed(4)}`;
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
// Message renderers
// ---------------------------------------------------------------------------

function UserMessageBubble({
  msg,
  isCurrentUser,
}: {
  msg: ParsedMessage;
  isCurrentUser: boolean;
}) {
  const resolveText = useResolveText();
  const textBlock = msg.blocks.find((b) => b.type === "text");

  return (
    <Message from={isCurrentUser ? "user" : "assistant"}>
      <div
        className={cn(
          "flex items-center gap-2",
          isCurrentUser ? "justify-end" : "justify-start",
        )}
      >
        {msg.senderName ? (
          <span className="text-xs font-medium text-foreground/70">
            {resolveText(msg.senderName)}
          </span>
        ) : null}
        {msg.timestamp ? (
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(msg.timestamp)}
          </span>
        ) : null}
      </div>
      <MessageContent>
        {textBlock?.type === "text" ? (
          <MessageResponse>{resolveText(textBlock.text)}</MessageResponse>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function AssistantMessageBubble({ msg }: { msg: ParsedMessage }) {
  const resolveText = useResolveText();
  const thinkingBlocks = msg.blocks.filter(
    (b): b is ParsedContentBlock & { type: "thinking" } =>
      b.type === "thinking",
  );
  const textBlocks = msg.blocks.filter(
    (b): b is ParsedContentBlock & { type: "text" } => b.type === "text",
  );
  const toolCallBlocks = msg.blocks.filter(
    (b): b is ParsedContentBlock & { type: "tool_call" } =>
      b.type === "tool_call",
  );

  return (
    <Message from="assistant">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground/70">Otto</span>
        {msg.model ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {msg.model}
          </Badge>
        ) : null}
        {msg.timestamp ? (
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(msg.timestamp)}
          </span>
        ) : null}
      </div>
      <MessageContent>
        {thinkingBlocks.map((block, i) => (
          <Reasoning key={`thinking-${i}`} defaultOpen={false}>
            <ReasoningTrigger />
            <ReasoningContent>{block.text}</ReasoningContent>
          </Reasoning>
        ))}
        {textBlocks.map((block, i) => (
          <MessageResponse key={`text-${i}`}>
            {resolveText(block.text)}
          </MessageResponse>
        ))}
        {toolCallBlocks.map((block, i) => (
          <ToolCallBlock key={`tool-${i}`} block={block} />
        ))}
      </MessageContent>
    </Message>
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

function ToolResultBubble({ msg }: { msg: ParsedMessage }) {
  const resolveText = useResolveText();
  const resultBlock = msg.blocks.find((b) => b.type === "tool_result") as
    | (ParsedContentBlock & { type: "tool_result" })
    | undefined;

  if (!resultBlock) return null;

  return (
    <Message from="assistant">
      <MessageContent>
        <Collapsible className="rounded-md border">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-2.5 text-sm">
            <div className="flex items-center gap-2">
              <WrenchIcon className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-xs font-medium">
                {resultBlock.name ?? "Tool result"}
              </span>
              {resultBlock.isError ? (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
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
      </MessageContent>
    </Message>
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
// Main component
// ---------------------------------------------------------------------------

export function TranscriptViewer({
  orgSlug,
  session,
  currentUserExternalIds = [],
  memberNames = {},
  channelNames = {},
}: {
  orgSlug: string;
  session: Session;
  currentUserExternalIds?: string[];
  memberNames?: Record<string, string>;
  channelNames?: Record<string, string>;
}) {
  const messages = useMemo(
    () => parseTranscript(session.transcriptJsonl),
    [session.transcriptJsonl],
  );

  const currentUserIdSet = useMemo(
    () => new Set(currentUserExternalIds),
    [currentUserExternalIds],
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
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            className="flex size-8 items-center justify-center rounded-md border hover:bg-muted"
            href={`/${orgSlug}/sessions`}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </Link>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold tracking-tight">
              {resolveText(title)}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              {session.sessionKey}
            </p>
          </div>
        </div>

        {/* Metadata cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <MetadataCard label="Status">
            <Badge variant={statusBadgeVariant[session.status] ?? "outline"}>
              {session.status}
            </Badge>
          </MetadataCard>
          <MetadataCard label="Channel">
            {session.channel ?? "-"}
          </MetadataCard>
          <MetadataCard label="Model">
            <span className="truncate">{session.model ?? "-"}</span>
          </MetadataCard>
          <MetadataCard label="Tokens">
            {formatTokens(session.totalTokens)}
          </MetadataCard>
          <MetadataCard label="Cost">
            {formatCost(session.estimatedCostUsd)}
          </MetadataCard>
          <MetadataCard label="Duration">
            {formatDuration(session.runtimeMs)}
          </MetadataCard>
        </div>

        {/* Transcript */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-medium">Transcript</h2>
            <p className="text-xs text-muted-foreground">
              {session.messageCount ?? messages.length} messages
            </p>
          </div>
          <div className="flex flex-col gap-6 p-5">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transcript data available.
              </p>
            ) : (
              messages.map((msg) => {
                switch (msg.kind) {
                  case "user": {
                    const isCurrentUser =
                      !!msg.senderId && currentUserIdSet.has(msg.senderId);
                    return (
                      <UserMessageBubble
                        key={msg.id}
                        msg={msg}
                        isCurrentUser={isCurrentUser}
                      />
                    );
                  }
                  case "assistant":
                    return (
                      <AssistantMessageBubble key={msg.id} msg={msg} />
                    );
                  case "tool_result":
                    return <ToolResultBubble key={msg.id} msg={msg} />;
                  case "compaction":
                    return <CompactionDivider key={msg.id} msg={msg} />;
                  default:
                    return null;
                }
              })
            )}
          </div>
        </div>
      </div>
    </ResolveTextContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Metadata card
// ---------------------------------------------------------------------------

function MetadataCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}
