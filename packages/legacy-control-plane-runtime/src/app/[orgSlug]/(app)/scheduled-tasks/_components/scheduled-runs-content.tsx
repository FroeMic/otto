"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import * as React from "react";

import { DataTable } from "../../../../../components/data-table";
import { DataTableColumnHeader } from "../../../../../components/data-table-column-header";
import { Badge } from "../../../../../components/ui/badge";
import {
  formatShortDateTime,
  type WorkspaceDateTimePreferences,
} from "../../../../../lib/date-time";

type ScheduledRunRow = {
  error: string | null;
  finishedAt: Date | null;
  hasSyncedSession: boolean;
  id: string;
  runtimeSessionKey: string | null;
  scheduledFor: Date | null;
  searchText: string;
  startedAt: Date | null;
  status: string;
  summary: string | null;
  taskKey: string;
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

function createColumns(
  dateTimePreferences: WorkspaceDateTimePreferences,
  orgSlug: string,
  hideTaskColumn: boolean,
): Array<ColumnDef<ScheduledRunRow>> {
  const columns: Array<ColumnDef<ScheduledRunRow>> = [];

  if (!hideTaskColumn) {
    columns.push({
      accessorKey: "taskName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Task" />
      ),
      size: 300,
      cell: ({ row }) => (
        <Link
          className="block truncate text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
          href={`/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(row.original.taskKey)}/overview`}
        >
          {row.original.taskName}
        </Link>
      ),
    });
  }

  columns.push(
    {
      id: "summary",
      accessorFn: (row) => row.summary ?? row.error ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Session" />
      ),
      size: 360,
      cell: ({ row }) => {
        const text = row.original.summary ?? row.original.error ?? "-";
        const className = row.original.error
          ? "block truncate text-sm text-destructive"
          : "block truncate text-sm text-muted-foreground";

        if (row.original.runtimeSessionKey && row.original.hasSyncedSession) {
          return (
            <Link
              className={`${className} hover:text-foreground transition-colors`}
              href={`/${orgSlug}/sessions/${encodeURIComponent(row.original.runtimeSessionKey)}`}
              title={text}
            >
              {text}
            </Link>
          );
        }

        return (
          <span className={className} title={text}>
            {text}
          </span>
        );
      },
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
          {formatShortDateTime(row.original.scheduledFor, dateTimePreferences)}
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
          {formatShortDateTime(row.original.startedAt, dateTimePreferences)}
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
          {formatShortDateTime(row.original.finishedAt, dateTimePreferences)}
        </span>
      ),
    },
  );

  return columns;
}

export function ScheduledRunsContent({
  dateTimePreferences,
  hideTaskColumn = false,
  orgSlug,
  runs,
}: {
  dateTimePreferences: WorkspaceDateTimePreferences;
  hideTaskColumn?: boolean;
  orgSlug: string;
  runs: Array<{
    error: string | null;
    finishedAt: Date | null;
    hasSyncedSession: boolean;
    id: string;
    runtimeSessionKey: string | null;
    scheduledFor: Date | null;
    startedAt: Date | null;
    status: string;
    summary: string | null;
    taskKey: string;
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

  const columns = React.useMemo(
    () => createColumns(dateTimePreferences, orgSlug, hideTaskColumn),
    [dateTimePreferences, orgSlug, hideTaskColumn],
  );

  return (
    <DataTable
      bodyClassName="align-middle"
      cellClassName="h-12 px-4 py-2"
      columns={columns}
      data={rows}
      emptyMessage="No task runs synced yet."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="border-b-0 hover:bg-muted/30"
      searchInputClassName="h-9 w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
      searchKeys={["searchText"]}
      searchPlaceholder="Search task runs"
      tableClassName="min-w-full table-fixed"
      toolbarClassName="pb-4 sm:flex-col sm:items-stretch lg:flex-row lg:items-center lg:justify-between"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  );
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
