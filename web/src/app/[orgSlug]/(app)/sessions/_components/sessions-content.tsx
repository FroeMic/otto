"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState, useMemo } from "react";

import { DataTable } from "@/components/data-table";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";
import { Badge } from "@/components/ui/badge";

export type SessionRow = {
  id: string;
  sessionKey: string;
  displayName: string | null;
  label: string | null;
  subject: string | null;
  channel: string | null;
  chatType: string | null;
  originFrom: string | null;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  runtimeMs: number | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: string | null;
  messageCount: number | null;
  spawnDepth: number | null;
  sessionUpdatedAt: number | null;
  lastSyncedAt: Date;
};

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  running: "default",
  done: "secondary",
  failed: "destructive",
  killed: "destructive",
  timeout: "destructive",
};

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatTokens(n: number | null): string {
  if (n === null || n === undefined) return "-";
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

function formatTime(date: Date | null): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sessionTitle(row: SessionRow): string {
  return (
    row.displayName ||
    row.label ||
    row.subject ||
    row.sessionKey
  );
}

function createColumns(orgSlug: string): ColumnDef<SessionRow>[] {
  return [
    {
      accessorKey: "displayName",
      header: "Session",
      size: 240,
      cell: ({ row }) => (
        <Link
          className="block max-w-[240px] truncate text-sm font-medium text-foreground hover:underline"
          href={`/${orgSlug}/sessions/${encodeURIComponent(row.original.sessionKey)}`}
        >
          {sessionTitle(row.original)}
        </Link>
      ),
    },
    {
      accessorKey: "channel",
      header: "Channel",
      size: 90,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.channel ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 80,
      cell: ({ row }) => (
        <Badge
          variant={statusBadgeVariant[row.original.status] ?? "outline"}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "model",
      header: "Model",
      size: 140,
      cell: ({ row }) => (
        <span className="block max-w-[140px] truncate text-sm text-muted-foreground">
          {row.original.model ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "totalTokens",
      header: "Tokens",
      size: 80,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatTokens(row.original.totalTokens)}
        </span>
      ),
    },
    {
      accessorKey: "estimatedCostUsd",
      header: "Cost",
      size: 70,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatCost(row.original.estimatedCostUsd)}
        </span>
      ),
    },
    {
      accessorKey: "messageCount",
      header: "Messages",
      size: 80,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original.messageCount ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "runtimeMs",
      header: "Duration",
      size: 80,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatDuration(row.original.runtimeMs)}
        </span>
      ),
    },
    {
      accessorKey: "startedAt",
      header: "Started",
      size: 130,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatTime(row.original.startedAt)}
        </span>
      ),
    },
  ];
}

export function SessionsContent({
  orgSlug,
  sessions,
}: {
  orgSlug: string;
  sessions: SessionRow[];
}) {
  const [filter, setFilter] = useState("");
  const columns = useMemo(() => createColumns(orgSlug), [orgSlug]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return sessions;
    const q = filter.toLowerCase();
    return sessions.filter((s) => {
      const title = sessionTitle(s).toLowerCase();
      const channel = (s.channel ?? "").toLowerCase();
      const status = s.status.toLowerCase();
      return title.includes(q) || channel.includes(q) || status.includes(q);
    });
  }, [sessions, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Agent conversation sessions synced from the runtime.{" "}
            <span className="font-medium text-foreground">
              {sessions.length}
            </span>{" "}
            sessions.
          </p>
        </div>
        <ToolbarSearchInput
          aria-label="Search sessions"
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search sessions..."
          value={filter}
        />
      </div>
      <DataTable
        bodyClassName="align-middle"
        cellClassName="h-12 py-2.5"
        columns={columns}
        data={filtered}
        emptyMessage="No sessions synced yet."
        fillAvailableSpace
        headClassName="h-11 px-4 text-sm font-medium text-foreground"
        headerClassName="[&_tr]:border-0 sticky top-0 z-10 bg-background"
        rowClassName="border-0 hover:bg-muted/50"
        tableClassName="min-w-full table-fixed"
        tableContainerClassName="!overflow-visible"
        viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
      />
    </div>
  );
}
