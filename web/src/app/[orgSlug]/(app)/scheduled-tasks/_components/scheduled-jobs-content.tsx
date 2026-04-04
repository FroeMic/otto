"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type ScheduledJobFilter = "active" | "all" | "disabled";

const JOB_FILTER_OPTIONS = [
  { label: "All tasks", value: "all" },
  { label: "Active tasks", value: "active" },
  { label: "Disabled tasks", value: "disabled" },
] as const satisfies Array<{ label: string; value: ScheduledJobFilter }>;

type ScheduledJobRow = {
  description: string | null;
  enabled: boolean;
  id: string;
  lastError: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastSyncError: string | null;
  lastSyncedAt: Date;
  name: string;
  nextRunAt: Date | null;
  scheduleExpression: string;
  searchText: string;
  status: string;
};

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  paused: "secondary",
  sync_failed: "destructive",
};

function createColumns(): Array<ColumnDef<ScheduledJobRow>> {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Scheduled task" />
      ),
      size: 300,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">
            {row.original.name}
          </span>
          {row.original.description ? (
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {row.original.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "scheduleExpression",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Schedule" />
      ),
      size: 220,
      cell: ({ row }) => {
        const schedule =
          row.original.scheduleExpression.trim().length > 0
            ? row.original.scheduleExpression
            : "No schedule";

        return (
          <span className="block truncate text-sm text-muted-foreground">
            {schedule}
          </span>
        );
      },
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
      id: "lastRunAt",
      accessorFn: (row) => row.lastRunAt?.getTime() ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last run" />
      ),
      size: 150,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.lastRunAt)}
          </span>
          {row.original.lastRunStatus ? (
            <span className="text-xs text-muted-foreground">
              {formatStatusLabel(row.original.lastRunStatus)}
            </span>
          ) : row.original.lastError ? (
            <span className="line-clamp-1 text-xs text-destructive">
              {row.original.lastError}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "nextRunAt",
      accessorFn: (row) => row.nextRunAt?.getTime() ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Next run" />
      ),
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.nextRunAt)}
        </span>
      ),
    },
    {
      id: "lastSyncedAt",
      accessorFn: (row) => row.lastSyncedAt.getTime(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last sync" />
      ),
      size: 220,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.lastSyncedAt)}
          </span>
          {row.original.lastSyncError ? (
            <span className="line-clamp-2 text-destructive">
              {row.original.lastSyncError}
            </span>
          ) : null}
        </div>
      ),
    },
  ];
}

export function ScheduledJobsContent({
  jobs,
}: {
  jobs: Array<{
    description: string | null;
    enabled: boolean;
    id: string;
    lastError: string | null;
    lastRunAt: Date | null;
    lastRunStatus: string | null;
    lastSyncError: string | null;
    lastSyncedAt: Date;
    name: string;
    nextRunAt: Date | null;
    scheduleExpression: string;
    status: string;
  }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filter = parseFilter(searchParams.get("status"));

  const rows = React.useMemo<Array<ScheduledJobRow>>(
    () =>
      jobs.map((job) => ({
        ...job,
        searchText: [
          job.name,
          job.description ?? "",
          job.scheduleExpression,
          job.status,
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [jobs],
  );

  const filteredRows = React.useMemo(() => {
    if (filter === "active") {
      return rows.filter((job) => job.enabled);
    }

    if (filter === "disabled") {
      return rows.filter((job) => !job.enabled);
    }

    return rows;
  }, [filter, rows]);

  const columns = React.useMemo(() => createColumns(), []);

  function updateFilter(nextFilter: ScheduledJobFilter) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextFilter === "all") {
      params.delete("status");
    } else {
      params.set("status", nextFilter);
    }

    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <DataTable
      bodyClassName="align-top"
      cellClassName="h-16 px-4 py-3"
      columns={columns}
      data={filteredRows}
      emptyMessage="No scheduled tasks synced yet."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="border-b-0 hover:bg-muted/30"
      searchInputClassName="h-9 w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
      searchKeys={["searchText"]}
      searchPlaceholder="Search scheduled tasks"
      tableClassName="min-w-full table-fixed"
      toolbar={
        <NativeSelect
          className="sm:w-40 sm:min-w-40 sm:max-w-40 sm:flex-none"
          onChange={(event) =>
            updateFilter(event.target.value as ScheduledJobFilter)
          }
          size="default"
          value={filter}
        >
          {JOB_FILTER_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      }
      toolbarClassName="pb-4 sm:flex-col sm:items-stretch lg:flex-row lg:items-center lg:justify-between"
      toolbarContentClassName="sm:w-full lg:w-auto"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  );
}

function parseFilter(value: string | null): ScheduledJobFilter {
  if (value === "active" || value === "disabled") {
    return value;
  }

  return "all";
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
