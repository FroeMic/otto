"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Badge } from "@/components/ui/badge";

type ScheduledRunRow = {
  error: string | null;
  finishedAt: Date | null;
  id: string;
  runtimeSessionKey: string | null;
  scheduledFor: Date | null;
  searchText: string;
  startedAt: Date | null;
  status: string;
  summary: string | null;
  taskName: string;
  triggerType: string;
};

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  failed: "destructive",
  skipped: "outline",
  succeeded: "secondary",
  unknown: "outline",
};

function createColumns(orgSlug: string): Array<ColumnDef<ScheduledRunRow>> {
  return [
    {
      accessorKey: "taskName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Job" />
      ),
      size: 300,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">
            {row.original.taskName}
          </span>
          {row.original.summary ? (
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {row.original.summary}
            </span>
          ) : row.original.error ? (
            <span className="line-clamp-2 text-sm text-destructive">
              {row.original.error}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "triggerType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trigger" />
      ),
      size: 120,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.triggerType}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      size: 120,
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant[row.original.status] ?? "outline"}>
          {formatStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "scheduledFor",
      accessorFn: (row) => row.scheduledFor?.getTime() ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Scheduled for" />
      ),
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.scheduledFor)}
        </span>
      ),
    },
    {
      id: "startedAt",
      accessorFn: (row) => row.startedAt?.getTime() ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Started" />
      ),
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.startedAt)}
        </span>
      ),
    },
    {
      id: "finishedAt",
      accessorFn: (row) => row.finishedAt?.getTime() ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Finished" />
      ),
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.finishedAt)}
        </span>
      ),
    },
    {
      accessorKey: "runtimeSessionKey",
      header: "Session",
      size: 140,
      cell: ({ row }) =>
        row.original.runtimeSessionKey ? (
          <Link
            className="text-sm font-medium text-foreground underline underline-offset-4"
            href={`/${orgSlug}/sessions/${encodeURIComponent(row.original.runtimeSessionKey)}`}
          >
            View session
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">
            No linked session
          </span>
        ),
    },
  ];
}

export function ScheduledRunsContent({
  orgSlug,
  runs,
}: {
  orgSlug: string;
  runs: Array<{
    error: string | null;
    finishedAt: Date | null;
    id: string;
    runtimeSessionKey: string | null;
    scheduledFor: Date | null;
    startedAt: Date | null;
    status: string;
    summary: string | null;
    taskName: string;
    triggerType: string;
  }>;
}) {
  const rows = React.useMemo<Array<ScheduledRunRow>>(
    () =>
      runs.map((run) => ({
        ...run,
        searchText: [
          run.taskName,
          run.triggerType,
          run.status,
          run.summary ?? "",
          run.error ?? "",
          run.runtimeSessionKey ?? "",
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [runs],
  );

  const columns = React.useMemo(() => createColumns(orgSlug), [orgSlug]);

  return (
    <DataTable
      bodyClassName="align-top"
      cellClassName="h-16 px-4 py-3"
      columns={columns}
      data={rows}
      emptyMessage="No scheduled job runs synced yet."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="border-b-0 hover:bg-muted/30"
      searchInputClassName="h-9 w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
      searchKeys={["searchText"]}
      searchPlaceholder="Search runs"
      tableClassName="min-w-full table-fixed"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  );
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
