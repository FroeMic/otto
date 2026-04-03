"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

type TranscriptMessage = {
  id?: string;
  type?: string;
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
    model?: string;
    provider?: string;
    usage?: {
      input?: number;
      output?: number;
      totalTokens?: number;
      cost?: { total?: number };
    };
    stopReason?: string;
    timestamp?: number;
  };
  timestamp?: string | number;
};

function parseTranscript(jsonl: string | null): TranscriptMessage[] {
  if (!jsonl) return [];

  return jsonl
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as TranscriptMessage;
      } catch {
        return null;
      }
    })
    .filter((m): m is TranscriptMessage => m !== null);
}

function extractRole(msg: TranscriptMessage): string {
  if (msg.message?.role) return msg.message.role;
  if (msg.role) return msg.role;
  if (msg.type === "session") return "system";
  if (msg.type === "compaction") return "system";
  return "unknown";
}

function extractTextContent(
  content: string | Array<{ type: string; text?: string }> | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!)
    .join("\n");
}

function extractText(msg: TranscriptMessage): string {
  if (msg.type === "session") {
    return `Session started (${msg.id ?? "unknown"})`;
  }
  if (msg.type === "compaction") {
    return "Context compacted";
  }

  const inner = msg.message;
  if (inner) {
    return extractTextContent(inner.content);
  }

  return extractTextContent(msg.content);
}

function extractToolCalls(
  msg: TranscriptMessage,
): Array<{ name: string; id?: string }> {
  const content = msg.message?.content ?? msg.content;
  if (!Array.isArray(content)) return [];

  return content
    .filter(
      (block: Record<string, unknown>) =>
        block.type === "tool_call" ||
        block.type === "tool_use" ||
        block.type === "function_call",
    )
    .map((block: Record<string, unknown>) => ({
      name: (block.name as string) ?? (block.function as string) ?? "tool",
      id: block.id as string | undefined,
    }));
}

function formatTimestamp(ts: number | string | undefined): string {
  if (!ts) return "";
  const d = new Date(typeof ts === "string" ? ts : ts);
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

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

const roleColors: Record<string, string> = {
  user: "border-blue-500/30 bg-blue-500/5",
  assistant: "border-emerald-500/30 bg-emerald-500/5",
  system: "border-amber-500/30 bg-amber-500/5",
  tool: "border-purple-500/30 bg-purple-500/5",
};

const roleLabels: Record<string, string> = {
  user: "User",
  assistant: "Assistant",
  system: "System",
  tool: "Tool",
};

export function TranscriptViewer({
  orgSlug,
  session,
}: {
  orgSlug: string;
  session: Session;
}) {
  const messages = useMemo(
    () => parseTranscript(session.transcriptJsonl),
    [session.transcriptJsonl],
  );

  const title =
    session.displayName || session.label || session.subject || session.sessionKey;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          className="flex size-8 items-center justify-center rounded-md border hover:bg-muted"
          href={`/${orgSlug}/sessions`}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        </Link>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-xs text-muted-foreground font-mono">
            {session.sessionKey}
          </p>
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
          <CardDescription>
            {session.messageCount ?? messages.length} messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transcript data available.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg, i) => {
                const role = extractRole(msg);
                const text = extractText(msg);
                const toolCalls = extractToolCalls(msg);
                const ts =
                  msg.message?.timestamp ?? msg.timestamp;

                if (role === "system" && msg.type === "session") {
                  return (
                    <div
                      key={i}
                      className="text-center text-xs text-muted-foreground py-2"
                    >
                      {text}
                    </div>
                  );
                }

                if (role === "system" && msg.type === "compaction") {
                  return (
                    <div
                      key={i}
                      className="text-center text-xs text-muted-foreground py-1 border-y border-dashed"
                    >
                      Context compacted
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border-l-2 p-3",
                      roleColors[role] ?? "border-gray-500/30 bg-gray-500/5",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        {roleLabels[role] ?? role}
                      </span>
                      {ts ? (
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(ts)}
                        </span>
                      ) : null}
                    </div>
                    {text ? (
                      <pre className="whitespace-pre-wrap break-words text-sm font-sans leading-relaxed">
                        {text}
                      </pre>
                    ) : null}
                    {toolCalls.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {toolCalls.map((tc, j) => (
                          <Badge key={j} variant="outline" className="font-mono text-xs">
                            {tc.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
