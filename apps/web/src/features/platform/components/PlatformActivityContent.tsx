import type { ColumnDef } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"

import type {
  PlatformActivityEventRow,
  PlatformActivityJobRow,
} from "@/features/platform/activity"
import {
  formatPreciseDateTime,
  type PlatformDateTimePreferences,
} from "@/features/platform/date-time"
import {
  DataTable,
} from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"

type JobFilter = "all" | "apply"

const JOB_FILTER_OPTIONS = [
  { label: "All jobs", value: "all" },
  { label: "Apply only", value: "apply" },
] as const

const EVENT_FILTER_OPTIONS = [
  { label: "All events", value: "all" },
  { label: "Apply only", value: "apply" },
] as const

function truncateId(value: string) {
  if (value.length <= 10) {
    return value
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function formatStatus(status: string | null) {
  if (!status) {
    return "Not available"
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getStatusVariant(status: string | null) {
  switch (status) {
    case "connected":
    case "ready":
    case "succeeded":
      return "secondary" as const
    case "failed":
    case "error":
    case "apply_failed":
      return "destructive" as const
    default:
      return "outline" as const
  }
}

export interface PlatformActivityContentProps {
  dateTimePreferences: PlatformDateTimePreferences
  events: PlatformActivityEventRow[]
  jobs: PlatformActivityJobRow[]
  mode: "events" | "jobs"
  orgSlug: string
}

export function PlatformActivityContent({
  dateTimePreferences,
  events,
  jobs,
  mode,
  orgSlug,
}: PlatformActivityContentProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [filter, setFilter] = useState<JobFilter>("all")
  const [eventJobFilter, setEventJobFilter] = useState<string | null>(null)

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return
    }

    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ["platform-organization-detail", orgSlug],
      })
    }, 10_000)

    return () => window.clearInterval(intervalId)
  }, [autoRefreshEnabled, orgSlug, queryClient])

  const filteredJobs = useMemo(() => {
    if (filter === "apply") {
      return jobs.filter((job) => job.jobType === "apply_tenant_config")
    }

    return jobs
  }, [filter, jobs])

  const filteredEvents = useMemo(() => {
    let nextEvents = events

    if (filter === "apply") {
      nextEvents = nextEvents.filter(
        (event) => event.jobType === "apply_tenant_config",
      )
    }

    if (eventJobFilter) {
      nextEvents = nextEvents.filter((event) => event.jobRunId === eventJobFilter)
    }

    return nextEvents
  }, [eventJobFilter, events, filter])

  const jobColumns: Array<ColumnDef<PlatformActivityJobRow>> = [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => <code>{truncateId(row.original.id)}</code>,
      size: 170,
    },
    {
      accessorKey: "jobType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => formatStatus(row.original.jobType),
      size: 180,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)}>
          {formatStatus(row.original.status)}
        </Badge>
      ),
      size: 130,
    },
    {
      accessorKey: "step",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Step" />
      ),
      cell: ({ row }) => formatStatus(row.original.step),
      size: 180,
    },
    {
      accessorKey: "eventsCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Events" />
      ),
      cell: ({ row }) => (
        <Button
          onClick={() => {
            setEventJobFilter(row.original.id)
            navigate({
              params: {
                platformOrgSlug: orgSlug,
              },
              to: "/platform/organizations/$platformOrgSlug/events",
            })
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {row.original.eventsCount}
        </Button>
      ),
      size: 120,
    },
    {
      id: "startedAt",
      accessorFn: (row) => row.startedAt ?? row.createdAt,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Started" />
      ),
      cell: ({ row }) =>
        formatPreciseDateTime(
          row.original.startedAt ?? row.original.createdAt,
          dateTimePreferences,
        ),
      size: 180,
    },
    {
      id: "finishedAt",
      accessorFn: (row) => row.finishedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Finished" />
      ),
      cell: ({ row }) =>
        formatPreciseDateTime(row.original.finishedAt, dateTimePreferences),
      size: 180,
    },
  ]

  const eventColumns: Array<ColumnDef<PlatformActivityEventRow>> = [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => <code>{truncateId(row.original.id)}</code>,
      size: 170,
    },
    {
      id: "createdAt",
      accessorFn: (row) => row.createdAt,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Time" />
      ),
      cell: ({ row }) =>
        formatPreciseDateTime(row.original.createdAt, dateTimePreferences),
      size: 180,
    },
    {
      accessorKey: "jobRunId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Job" />
      ),
      cell: ({ row }) => <code>{truncateId(row.original.jobRunId)}</code>,
      size: 170,
    },
    {
      accessorKey: "jobType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Job type" />
      ),
      cell: ({ row }) => formatStatus(row.original.jobType),
      size: 170,
    },
    {
      accessorKey: "eventType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Event" />
      ),
      cell: ({ row }) => formatStatus(row.original.eventType),
      size: 180,
    },
    {
      accessorKey: "message",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Message" />
      ),
      cell: ({ row }) => (
        <span className="block whitespace-normal break-words text-sm text-muted-foreground">
          {row.original.message}
        </span>
      ),
      size: 520,
    },
  ]

  return mode === "jobs" ? (
    <DataTable
      bodyClassName="align-top"
      cellClassName="h-16 px-4 py-3 md:px-6"
      columns={jobColumns}
      data={filteredJobs}
      emptyMessage="No jobs found."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground md:px-6"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="hover:bg-transparent"
      searchKeys={["id", "jobType", "status", "step", "searchText"]}
      searchPlaceholder="Search jobs"
      tableClassName="min-w-full table-fixed"
      toolbar={
        <div className="flex w-full min-w-0 items-center gap-2">
          <NativeSelect
            className="sm:w-40 sm:min-w-40 sm:max-w-40 sm:flex-none"
            onChange={(event) => setFilter(event.target.value as JobFilter)}
            size="default"
            value={filter}
          >
            {JOB_FILTER_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <span>Live updates</span>
            <Switch
              checked={autoRefreshEnabled}
              onCheckedChange={setAutoRefreshEnabled}
              size="sm"
            />
          </div>
        </div>
      }
      toolbarClassName="px-4 pb-4 md:px-6"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  ) : (
    <DataTable
      bodyClassName="align-top"
      cellClassName="h-16 px-4 py-3 md:px-6"
      columns={eventColumns}
      data={filteredEvents}
      emptyMessage="No events found."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground md:px-6"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="hover:bg-transparent"
      searchKeys={["id", "jobRunId", "jobType", "eventType", "message", "searchText"]}
      searchPlaceholder="Search events"
      tableClassName="min-w-full table-fixed"
      toolbar={
        <div className="flex w-full min-w-0 items-center gap-2">
          <NativeSelect
            className="sm:w-40 sm:min-w-40 sm:max-w-40 sm:flex-none"
            onChange={(event) => setFilter(event.target.value as JobFilter)}
            size="default"
            value={filter}
          >
            {EVENT_FILTER_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="flex min-w-0 flex-1 items-center">
            {eventJobFilter ? (
              <div className="flex min-w-0 items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Job</span>
                <code className="truncate text-foreground">
                  {truncateId(eventJobFilter)}
                </code>
                <Button
                  className="h-auto shrink-0 px-1.5 py-0.5 text-xs"
                  onClick={() => setEventJobFilter(null)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <span>Live updates</span>
            <Switch
              checked={autoRefreshEnabled}
              onCheckedChange={setAutoRefreshEnabled}
              size="sm"
            />
          </div>
        </div>
      }
      toolbarClassName="px-4 pb-4 md:px-6"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  )
}
