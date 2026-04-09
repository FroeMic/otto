"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { DataTable } from "../../../../../components/data-table";
import { DataTableColumnHeader } from "../../../../../components/data-table-column-header";
import { Badge } from "../../../../../components/ui/badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../../components/ui/native-select";
import {
  formatShortDateTime,
  type WorkspaceDateTimePreferences,
} from "../../../../../lib/date-time";
import { describeScheduledTaskSchedule } from "../../../../../lib/scheduled-tasks/cron-description";

type ScheduledJobFilter = "active" | "all" | "deleted" | "disabled";

const JOB_FILTER_OPTIONS = [
  { label: "All tasks", value: "all" },
  { label: "Active tasks", value: "active" },
  { label: "Disabled tasks", value: "disabled" },
  { label: "Deleted tasks", value: "deleted" },
] as const satisfies Array<{ label: string; value: ScheduledJobFilter }>;

type ScheduledJobRow = {
  enabled: boolean;
  id: string;
  lastError: string | null;
  lastRunAt: Date | null;
  lastSyncError: string | null;
  lastSyncedAt: Date;
  name: string;
  nextRunAt: Date | null;
  scheduleDescription: string;
  scheduleExpression: string;
  searchText: string;
  status: string;
  taskKey: string;
};

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  deleted: "outline",
  paused: "secondary",
  sync_failed: "destructive",
};

function createColumns(
  dateTimePreferences: WorkspaceDateTimePreferences,
  orgSlug: string,
): Array<ColumnDef<ScheduledJobRow>> {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Task" />
      ),
      size: 300,
      cell: ({ row }) => (
        <Link
          className="block truncate text-sm font-medium text-foreground"
          href={`/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(row.original.taskKey)}/overview`}
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "scheduleDescription",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Schedule" />
      ),
      size: 240,
      cell: ({ row }) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={row.original.scheduleExpression}
        >
          {row.original.scheduleDescription}
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
      id: "lastRunAt",
      accessorFn: (row) => row.lastRunAt?.getTime() ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last run" />
      ),
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatShortDateTime(row.original.lastRunAt, dateTimePreferences)}
        </span>
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
          {formatShortDateTime(row.original.nextRunAt, dateTimePreferences)}
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
        <span
          className="block truncate text-sm text-muted-foreground"
          title={row.original.lastSyncError ?? undefined}
        >
          {formatShortDateTime(row.original.lastSyncedAt, dateTimePreferences)}
        </span>
      ),
    },
  ];
}

export function ScheduledJobsContent({
  dateTimePreferences,
  jobs,
  orgSlug,
}: {
  dateTimePreferences: WorkspaceDateTimePreferences;
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
    scheduleJson: Record<string, unknown> | null;
    status: string;
    taskKey: string;
    timezone: string | null;
  }>;
  orgSlug: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filter = parseFilter(searchParams.get("status"));

  const rows = React.useMemo<Array<ScheduledJobRow>>(
    () =>
      jobs.map((job) => {
        const scheduleDescription = describeScheduledTaskSchedule({
          dateTimePreferences,
          scheduleExpression: job.scheduleExpression,
          scheduleJson: job.scheduleJson,
          timezone: job.timezone,
        });

        return {
          enabled: job.enabled,
          id: job.id,
          lastError: job.lastError,
          lastRunAt: job.lastRunAt,
          lastSyncError: job.lastSyncError,
          lastSyncedAt: job.lastSyncedAt,
          name: job.name,
          nextRunAt: job.nextRunAt,
          scheduleDescription,
          scheduleExpression: job.scheduleExpression,
          searchText: [
            job.name,
            job.description ?? "",
            job.scheduleExpression,
            scheduleDescription,
            job.status,
            job.lastError ?? "",
          ]
            .join(" ")
            .toLowerCase(),
          status: job.status,
          taskKey: job.taskKey,
        };
      }),
    [jobs, dateTimePreferences],
  );

  const filteredRows = React.useMemo(() => {
    if (filter === "active") {
      return rows.filter((job) => job.enabled);
    }

    if (filter === "disabled") {
      return rows.filter((job) => job.status === "paused");
    }

    if (filter === "deleted") {
      return rows.filter((job) => job.status === "deleted");
    }

    return rows;
  }, [filter, rows]);

  const columns = React.useMemo(
    () => createColumns(dateTimePreferences, orgSlug),
    [dateTimePreferences, orgSlug],
  );

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
      bodyClassName="align-middle"
      cellClassName="h-12 px-4 py-2"
      columns={columns}
      data={filteredRows}
      emptyMessage="No scheduled tasks synced yet."
      fillAvailableSpace
      getRowAriaLabel={(row) => `Open scheduled task ${row.name}`}
      getRowHref={(row) =>
        `/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(row.taskKey)}/overview`
      }
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
  if (value === "active" || value === "deleted" || value === "disabled") {
    return value;
  }

  return "all";
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
