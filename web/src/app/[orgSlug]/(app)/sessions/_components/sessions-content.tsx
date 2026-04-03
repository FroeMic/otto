"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { useState, useMemo } from "react";

import { DataTable } from "@/components/data-table";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  canViewSessionDetail,
  formatSessionName,
  getProviderIcon,
  getProviderLabel,
  parseSessionKey,
} from "../_lib/session-display";

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

const kindBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  dm: "default",
  channel: "secondary",
  group: "secondary",
  thread: "outline",
  main: "outline",
};

const kindLabels: Record<string, string> = {
  dm: "DM",
  channel: "Channel",
  group: "Group",
  thread: "Thread",
  main: "Shared",
};

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
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

function ChannelCell({ row }: { row: SessionRow }) {
  const parsed = parseSessionKey(row.sessionKey);
  const icon = getProviderIcon(parsed.provider);
  const label = getProviderLabel(parsed.provider);
  const kindLabel = kindLabels[parsed.kind] ?? parsed.kind;
  const kindVariant = kindBadgeVariant[parsed.kind] ?? "outline";

  return (
    <div className="flex items-center gap-2">
      {icon ? (
        <Image
          alt={label}
          className="size-4 shrink-0"
          height={16}
          src={icon}
          width={16}
        />
      ) : null}
      <Badge variant={kindVariant} className="text-[10px] px-1.5 py-0">
        {kindLabel}
      </Badge>
    </div>
  );
}

function createColumns(input: {
  orgSlug: string;
  currentUserExternalIds: string[];
  isPlatformAdmin: boolean;
}): ColumnDef<SessionRow>[] {
  return [
    {
      accessorKey: "displayName",
      header: "Session",
      size: 280,
      cell: ({ row }) => {
        const name = formatSessionName({
          sessionKey: row.original.sessionKey,
          displayName: row.original.displayName,
          label: row.original.label,
          subject: row.original.subject,
          originFrom: row.original.originFrom,
          chatType: row.original.chatType,
        });

        const canView = canViewSessionDetail({
          sessionKey: row.original.sessionKey,
          currentUserExternalIds: input.currentUserExternalIds,
          isPlatformAdmin: input.isPlatformAdmin,
          sessionOriginFrom: row.original.originFrom,
        });

        if (canView) {
          return (
            <Link
              className="block max-w-[280px] truncate text-sm font-medium text-foreground hover:underline"
              href={`/${input.orgSlug}/sessions/${encodeURIComponent(row.original.sessionKey)}`}
            >
              {name}
            </Link>
          );
        }

        return (
          <span
            className="block max-w-[280px] truncate text-sm text-muted-foreground"
            title="DM — only the session owner or admins can view"
          >
            {name}
          </span>
        );
      },
    },
    {
      accessorKey: "channel",
      header: "Channel",
      size: 110,
      cell: ({ row }) => <ChannelCell row={row.original} />,
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
  currentUserExternalIds = [],
  isPlatformAdmin = false,
}: {
  orgSlug: string;
  sessions: SessionRow[];
  currentUserExternalIds?: string[];
  isPlatformAdmin?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const columns = useMemo(
    () =>
      createColumns({
        orgSlug,
        currentUserExternalIds,
        isPlatformAdmin,
      }),
    [orgSlug, currentUserExternalIds, isPlatformAdmin],
  );

  const filtered = useMemo(() => {
    if (!filter.trim()) return sessions;
    const q = filter.toLowerCase();
    return sessions.filter((s) => {
      const name = formatSessionName({
        sessionKey: s.sessionKey,
        displayName: s.displayName,
        label: s.label,
        subject: s.subject,
        originFrom: s.originFrom,
        chatType: s.chatType,
      }).toLowerCase();
      const channel = (s.channel ?? "").toLowerCase();
      const status = s.status.toLowerCase();
      return name.includes(q) || channel.includes(q) || status.includes(q);
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
