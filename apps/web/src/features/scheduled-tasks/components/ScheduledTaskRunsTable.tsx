import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { ToolbarSearchInput } from "@/components/toolbar-search-input"
import { Badge } from "@/components/ui/badge"
import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"

import { formatShortDateTime } from "../lib/date-time"
import type { WorkspaceScheduledTaskRun } from "../types"

interface ScheduledTaskRunRow {
  error: string | null
  finishedAt: Date | null
  hasSyncedSession: boolean
  id: string
  runtimeSessionKey: string | null
  scheduledFor: Date | null
  searchText: string
  startedAt: Date | null
  status: string
  summary: string | null
  taskKey: string
  taskName: string
  triggerType: string
}

export interface ScheduledTaskRunsTableProps {
  dateTimePreferences: WorkspaceDateTimePreferences
  hideTaskColumn?: boolean
  orgSlug: string
  runs: WorkspaceScheduledTaskRun[]
}

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  failed: "destructive",
  skipped: "outline",
  succeeded: "secondary",
  unknown: "outline",
}

function createColumns(input: {
  dateTimePreferences: WorkspaceDateTimePreferences
  hideTaskColumn: boolean
  orgSlug: string
}): Array<ColumnDef<ScheduledTaskRunRow>> {
  const columns: Array<ColumnDef<ScheduledTaskRunRow>> = []

  if (!input.hideTaskColumn) {
    columns.push({
      accessorKey: "taskName",
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
          {row.original.taskName}
        </Link>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Task" />
      ),
      size: 300,
    })
  }

  columns.push(
    {
      accessorFn: (row) => row.summary ?? row.error ?? "",
      cell: ({ row }) => {
        const text = row.original.summary ?? row.original.error ?? "-"

        if (row.original.runtimeSessionKey && row.original.hasSyncedSession) {
          return (
            <Link
              className={
                row.original.error
                  ? "block truncate text-sm text-destructive"
                  : "block truncate text-sm text-muted-foreground hover:text-foreground"
              }
              params={{
                orgSlug: input.orgSlug,
                sessionKey: encodeURIComponent(row.original.runtimeSessionKey),
              }}
              preload="intent"
              title={text}
              to="/$orgSlug/sessions/$sessionKey"
            >
              {text}
            </Link>
          )
        }

        return (
          <span
            className={
              row.original.error
                ? "block truncate text-sm text-destructive"
                : "block truncate text-sm text-muted-foreground"
            }
            title={text}
          >
            {text}
          </span>
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Session" />
      ),
      id: "summary",
      size: 360,
    },
    {
      accessorKey: "triggerType",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.triggerType}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trigger" />
      ),
      size: 120,
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
      accessorFn: (row) => row.scheduledFor?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatShortDateTime(
            row.original.scheduledFor,
            input.dateTimePreferences,
          )}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Scheduled for" />
      ),
      id: "scheduledFor",
      size: 150,
    },
    {
      accessorFn: (row) => row.startedAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatShortDateTime(
            row.original.startedAt,
            input.dateTimePreferences,
          )}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Started" />
      ),
      id: "startedAt",
      size: 150,
    },
    {
      accessorFn: (row) => row.finishedAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatShortDateTime(
            row.original.finishedAt,
            input.dateTimePreferences,
          )}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Finished" />
      ),
      id: "finishedAt",
      size: 150,
    },
  )

  return columns
}

export function ScheduledTaskRunsTable({
  dateTimePreferences,
  hideTaskColumn = false,
  orgSlug,
  runs,
}: ScheduledTaskRunsTableProps) {
  const [query, setQuery] = useState("")

  const rows = useMemo<Array<ScheduledTaskRunRow>>(
    () =>
      runs.map((run) => ({
        error: run.error,
        finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
        hasSyncedSession: run.hasSyncedSession,
        id: run.id,
        runtimeSessionKey: run.runtimeSessionKey,
        scheduledFor: run.scheduledFor ? new Date(run.scheduledFor) : null,
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
        startedAt: run.startedAt ? new Date(run.startedAt) : null,
        status: run.status,
        summary: run.summary,
        taskKey: run.taskKey,
        taskName: run.taskName,
        triggerType: run.triggerType,
      })),
    [runs],
  )

  const filteredRows = useMemo(() => {
    if (!query.trim()) {
      return rows
    }

    const normalizedQuery = query.toLowerCase()

    return rows.filter((row) => row.searchText.includes(normalizedQuery))
  }, [query, rows])

  const columns = useMemo(
    () =>
      createColumns({
        dateTimePreferences,
        hideTaskColumn,
        orgSlug,
      }),
    [dateTimePreferences, hideTaskColumn, orgSlug],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ToolbarSearchInput
        aria-label="Search task runs"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search task runs"
        value={query}
      />

      <DataTable
        bodyClassName="align-middle"
        cellClassName="h-12 px-4 py-2"
        columns={columns}
        data={filteredRows}
        emptyMessage="No task runs synced yet."
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
