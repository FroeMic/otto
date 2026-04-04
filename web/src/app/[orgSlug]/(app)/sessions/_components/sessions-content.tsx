"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  canViewSessionDetail,
  formatSessionName,
  getProviderIcon,
  getProviderLabel,
  getScheduledTaskHref,
  parseSessionKey,
} from "../_lib/session-display";
import { SessionsActionsMenu } from "./sessions-actions-menu";

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

const kindLabels: Record<string, string> = {
  dm: "DM",
  channel: "Channel",
  group: "Group",
  thread: "Thread",
  main: "Shared",
};

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

function ProviderCell({
  provider,
  taskHref,
}: {
  provider: string | null;
  taskHref?: string | null;
}) {
  const icon = getProviderIcon(provider);
  const label = getProviderLabel(provider);
  const isCron = provider === "cron";

  const iconElement = isCron ? (
    <HugeiconsIcon icon={Calendar03Icon} className="size-4 shrink-0" />
  ) : icon ? (
    <Image
      alt={label}
      className="size-4 shrink-0"
      height={16}
      src={icon}
      width={16}
    />
  ) : null;

  // Cron sessions with a task link render as a button-style link (like capabilities Source column)
  if (isCron && taskHref) {
    return (
      <Link
        className={buttonVariants({ variant: "outline", size: "sm" })}
        href={taskHref}
      >
        {iconElement}
        {label}
      </Link>
    );
  }

  return (
    <span className={buttonVariants({ variant: "outline", size: "sm" })}>
      {iconElement}
      {label}
    </span>
  );
}

function createColumns(input: {
  orgSlug: string;
  currentUserExternalIds: string[];
  isPlatformAdmin: boolean;
  nameMaps: { channels: Map<string, string>; members: Map<string, string> };
  cronTaskKeys: Record<string, string>;
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
          nameMaps: input.nameMaps,
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
      id: "provider",
      header: "Channel",
      size: 140,
      cell: ({ row }) => {
        const parsed = parseSessionKey(row.original.sessionKey);
        const taskHref = getScheduledTaskHref(
          row.original.sessionKey,
          input.orgSlug,
          input.cronTaskKeys,
        );
        return <ProviderCell provider={parsed.provider} taskHref={taskHref} />;
      },
    },
    {
      id: "kind",
      header: "Type",
      size: 80,
      cell: ({ row }) => {
        const parsed = parseSessionKey(row.original.sessionKey);
        const label =
          parsed.provider === "cron"
            ? "Task Run"
            : (kindLabels[parsed.kind] ?? parsed.kind);
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 80,
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "model",
      header: "Model",
      size: 120,
      cell: ({ row }) => (
        <span className="block max-w-[120px] truncate text-sm text-muted-foreground">
          {row.original.model ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "totalTokens",
      header: "Tokens",
      size: 70,
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
      size: 70,
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
  channelNames = {},
  memberNames = {},
  cronTaskKeys = {},
}: {
  orgSlug: string;
  sessions: SessionRow[];
  currentUserExternalIds?: string[];
  isPlatformAdmin?: boolean;
  channelNames?: Record<string, string>;
  memberNames?: Record<string, string>;
  cronTaskKeys?: Record<string, string>;
}) {
  const [filter, setFilter] = useState("");

  const nameMaps = useMemo(
    () => ({
      channels: new Map(Object.entries(channelNames)),
      members: new Map(Object.entries(memberNames)),
    }),
    [channelNames, memberNames],
  );

  const columns = useMemo(
    () =>
      createColumns({
        orgSlug,
        currentUserExternalIds,
        isPlatformAdmin,
        nameMaps,
        cronTaskKeys,
      }),
    [orgSlug, currentUserExternalIds, isPlatformAdmin, nameMaps, cronTaskKeys],
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
        nameMaps,
      }).toLowerCase();
      const channel = (s.channel ?? "").toLowerCase();
      const status = s.status.toLowerCase();
      return name.includes(q) || channel.includes(q) || status.includes(q);
    });
  }, [sessions, filter, nameMaps]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
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
          <SessionsActionsMenu orgSlug={orgSlug} />
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
