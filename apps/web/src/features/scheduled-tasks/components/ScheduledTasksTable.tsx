import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { ToolbarSearchInput } from "@/components/toolbar-search-input"
import { Badge } from "@/components/ui/badge"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"

import { describeScheduledTaskSchedule } from "../lib/cron-description"
import { formatShortDateTime } from "../lib/date-time"
import type { WorkspaceScheduledTask } from "../types"

type ScheduledTaskFilter = "active" | "all" | "deleted" | "disabled"

interface ScheduledTaskRow {
  enabled: boolean
  id: string
  lastError: string | null
  lastRunAt: Date | null
  lastSyncError: string | null
  lastSyncedAt: Date | null
  name: string
  nextRunAt: Date | null
  scheduleDescription: string
  scheduleExpression: string
  searchText: string
  status: string
  taskKey: string
}

export interface ScheduledTasksTableProps {
  dateTimePreferences: WorkspaceDateTimePreferences
  orgSlug: string
  tasks: WorkspaceScheduledTask[]
}

const TASK_FILTER_OPTIONS = [
  { label: "All tasks", value: "all" },
  { label: "Active tasks", value: "active" },
  { label: "Disabled tasks", value: "disabled" },
  { label: "Deleted tasks", value: "deleted" },
] as const satisfies Array<{
  label: string
  value: ScheduledTaskFilter
}>

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  deleted: "outline",
  paused: "secondary",
  sync_failed: "destructive",
}

function createColumns(input: {
  dateTimePreferences: WorkspaceDateTimePreferences
  orgSlug: string
}): Array<ColumnDef<ScheduledTaskRow>> {
  return [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <Link
          className="block truncate text-sm font-medium text-foreground"
          params={{
            orgSlug: input.orgSlug,
            taskKey: encodeURIComponent(row.original.taskKey),
          }}
          preload="intent"
          to="/$orgSlug/scheduled-tasks/tasks/$taskKey/overview"
        >
          {row.original.name}
        </Link>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Task" />
      ),
      size: 300,
    },
    {
      accessorKey: "scheduleDescription",
      cell: ({ row }) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={row.original.scheduleExpression}
        >
          {row.original.scheduleDescription}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Schedule" />
      ),
      size: 240,
    },
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant[row.original.status] ?? "outline"}>
          {formatStatusLabel(row.original.status)}
        </Badge>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      size: 120,
    },
    {
      accessorFn: (row) => row.lastRunAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatShortDateTime(row.original.lastRunAt, input.dateTimePreferences)}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last run" />
      ),
      id: "lastRunAt",
      size: 150,
    },
    {
      accessorFn: (row) => row.nextRunAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatShortDateTime(row.original.nextRunAt, input.dateTimePreferences)}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Next run" />
      ),
      id: "nextRunAt",
      size: 150,
    },
    {
      accessorFn: (row) => row.lastSyncedAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={row.original.lastSyncError ?? undefined}
        >
          {formatShortDateTime(
            row.original.lastSyncedAt,
            input.dateTimePreferences,
          )}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last sync" />
      ),
      id: "lastSyncedAt",
      size: 220,
    },
  ]
}

export function ScheduledTasksTable({
  dateTimePreferences,
  orgSlug,
  tasks,
}: ScheduledTasksTableProps) {
  const [filter, setFilter] = useState<ScheduledTaskFilter>("all")
  const [query, setQuery] = useState("")

  const rows = useMemo<Array<ScheduledTaskRow>>(
    () =>
      tasks.map((task) => {
        const scheduleDescription = describeScheduledTaskSchedule({
          dateTimePreferences,
          scheduleExpression: task.scheduleExpression,
          scheduleJson: task.scheduleJson,
          timezone: task.timezone,
        })

        return {
          enabled: task.enabled,
          id: task.id,
          lastError: task.lastError,
          lastRunAt: task.lastRunAt ? new Date(task.lastRunAt) : null,
          lastSyncError: task.lastSyncError,
          lastSyncedAt: task.lastSyncedAt ? new Date(task.lastSyncedAt) : null,
          name: task.name,
          nextRunAt: task.nextRunAt ? new Date(task.nextRunAt) : null,
          scheduleDescription,
          scheduleExpression: task.scheduleExpression,
          searchText: [
            task.name,
            task.description ?? "",
            task.scheduleExpression,
            scheduleDescription,
            task.status,
            task.lastError ?? "",
          ]
            .join(" ")
            .toLowerCase(),
          status: task.status,
          taskKey: task.taskKey,
        }
      }),
    [dateTimePreferences, tasks],
  )

  const filteredRows = useMemo(() => {
    const visibleRows =
      filter === "active"
        ? rows.filter((row) => row.enabled)
        : filter === "disabled"
          ? rows.filter((row) => row.status === "paused")
          : filter === "deleted"
            ? rows.filter((row) => row.status === "deleted")
            : rows

    if (!query.trim()) {
      return visibleRows
    }

    const normalizedQuery = query.toLowerCase()

    return visibleRows.filter((row) => row.searchText.includes(normalizedQuery))
  }, [filter, query, rows])

  const columns = useMemo(
    () =>
      createColumns({
        dateTimePreferences,
        orgSlug,
      }),
    [dateTimePreferences, orgSlug],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToolbarSearchInput
          aria-label="Search scheduled tasks"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search scheduled tasks"
          value={query}
        />

        <NativeSelect
          aria-label="Filter scheduled tasks"
          onChange={(event) =>
            setFilter(event.target.value as ScheduledTaskFilter)
          }
          value={filter}
        >
          {TASK_FILTER_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <DataTable
        bodyClassName="align-middle"
        cellClassName="h-12 px-4 py-2"
        columns={columns}
        data={filteredRows}
        emptyMessage="No scheduled tasks synced yet."
        fillAvailableSpace
        headClassName="h-11 px-4 text-sm font-medium text-foreground"
        headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
        rowClassName="border-b-0 hover:bg-muted/30"
        tableClassName="min-w-full table-fixed"
        viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
      />
    </div>
  )
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

