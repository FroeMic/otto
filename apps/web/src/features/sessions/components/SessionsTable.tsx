import { CalendarBlankIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/data-table"
import { ToolbarSearchInput } from "@/components/toolbar-search-input"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"
import { cn } from "@/lib/utils"

import { formatShortDateTime } from "../lib/date-time"
import {
  canViewSessionDetail,
  formatSessionName,
  getProviderIcon,
  getProviderLabel,
  parseSessionKey,
} from "../lib/session-display"

export interface SessionRow {
  createdAt: string | null
  displayName: string | null
  endedAt: string | null
  estimatedCostUsd: string | null
  externalSessionId: string | null
  id: string
  inputTokens: number | null
  label: string | null
  lastMessageAt: number | null
  lastSyncedAt: string | null
  messageCount: number | null
  model: string | null
  modelProvider: string | null
  originFrom: string | null
  parentSessionKey: string | null
  runtimeMs: number | null
  sessionKey: string
  sessionUpdatedAt: number | null
  spawnDepth: number | null
  startedAt: string | null
  status: string
  subject: string | null
  subagentRole: string | null
  totalTokens: number | null
}

export interface SessionsTableProps {
  channelNames: Record<string, string>
  cronTaskKeys: Record<string, string>
  currentUserExternalIds: string[]
  dateTimePreferences: WorkspaceDateTimePreferences
  isPlatformAdmin: boolean
  memberNames: Record<string, string>
  orgSlug: string
  sessions: SessionRow[]
}

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  done: "secondary",
  failed: "destructive",
  killed: "destructive",
  running: "default",
  timeout: "destructive",
}

const kindLabels: Record<string, string> = {
  channel: "Channel",
  dm: "DM",
  group: "Group",
  main: "Shared",
  thread: "Thread",
}

function formatTokens(value: number | null) {
  if (value === null || value === undefined) return "-"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function formatCost(value: string | null) {
  if (!value) return "-"
  const numberValue = Number.parseFloat(value)
  if (Number.isNaN(numberValue) || numberValue === 0) return "-"
  return `$${numberValue.toFixed(4)}`
}

function createColumns(input: {
  cronTaskKeys: Record<string, string>
  currentUserExternalIds: string[]
  dateTimePreferences: WorkspaceDateTimePreferences
  isPlatformAdmin: boolean
  nameMaps: {
    channels: Map<string, string>
    members: Map<string, string>
  }
  orgSlug: string
}): ColumnDef<SessionRow>[] {
  return [
    {
      accessorKey: "displayName",
      cell: ({ row }) => {
        const name = formatSessionName({
          chatType: null,
          displayName: row.original.displayName,
          label: row.original.label,
          nameMaps: input.nameMaps,
          originFrom: row.original.originFrom,
          sessionKey: row.original.sessionKey,
          subject: row.original.subject,
        })
        const canView = canViewSessionDetail({
          currentUserExternalIds: input.currentUserExternalIds,
          isPlatformAdmin: input.isPlatformAdmin,
          sessionKey: row.original.sessionKey,
        })

        if (canView) {
          return (
            <Link
              className="block max-w-[280px] truncate text-sm font-medium text-foreground"
              params={{
                orgSlug: input.orgSlug,
                sessionKey: encodeURIComponent(row.original.sessionKey),
              }}
              preload="intent"
              to="/$orgSlug/sessions/$sessionKey"
            >
              {name}
            </Link>
          )
        }

        return (
          <span
            className="block max-w-[280px] truncate text-sm text-muted-foreground"
            title="DM — only the session owner or platform admins can view"
          >
            {name}
          </span>
        )
      },
      header: "Session",
      size: 280,
    },
    {
      id: "provider",
      cell: ({ row }) => {
        const parsed = parseSessionKey(row.original.sessionKey)
        const taskKey = input.cronTaskKeys[row.original.sessionKey]
        const taskHref = taskKey
          ? `/${input.orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(taskKey)}`
          : null
        const icon = getProviderIcon(parsed.provider)
        const label = getProviderLabel(parsed.provider)

        if (parsed.provider === "cron" && taskHref) {
          return (
            <a
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={taskHref}
            >
              <CalendarBlankIcon className="size-4 shrink-0" />
              {label}
            </a>
          )
        }

        return (
          <span className={buttonVariants({ size: "sm", variant: "outline" })}>
            {parsed.provider === "cron" ? (
              <CalendarBlankIcon className="size-4 shrink-0" />
            ) : icon ? (
              <img alt={label} className="size-4 shrink-0" src={icon} />
            ) : null}
            {label}
          </span>
        )
      },
      header: "Channel",
      size: 140,
    },
    {
      id: "kind",
      cell: ({ row }) => {
        const parsed = parseSessionKey(row.original.sessionKey)
        const label =
          parsed.provider === "cron"
            ? "Task Run"
            : (kindLabels[parsed.kind] ?? parsed.kind)

        return (
          <Badge className="px-1.5 py-0 text-[10px]" variant="outline">
            {label}
          </Badge>
        )
      },
      header: "Type",
      size: 90,
    },
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
      header: "Status",
      size: 90,
    },
    {
      accessorKey: "model",
      cell: ({ row }) => (
        <span className="block max-w-[120px] truncate text-sm text-muted-foreground">
          {row.original.model ?? "-"}
        </span>
      ),
      header: "Model",
      size: 130,
    },
    {
      accessorKey: "totalTokens",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatTokens(row.original.totalTokens)}
        </span>
      ),
      header: "Tokens",
      size: 80,
    },
    {
      accessorKey: "estimatedCostUsd",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatCost(row.original.estimatedCostUsd)}
        </span>
      ),
      header: "Cost",
      size: 80,
    },
    {
      accessorKey: "messageCount",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original.messageCount ?? "-"}
        </span>
      ),
      header: "Messages",
      size: 90,
    },
    {
      accessorKey: "lastMessageAt",
      cell: ({ row }) => {
        const lastMessageAt = row.original.lastMessageAt

        return (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {lastMessageAt
              ? formatShortDateTime(
                  new Date(lastMessageAt),
                  input.dateTimePreferences,
                )
              : formatShortDateTime(
                  row.original.startedAt
                    ? new Date(row.original.startedAt)
                    : null,
                  input.dateTimePreferences,
                )}
          </span>
        )
      },
      header: "Last Message",
      size: 140,
    },
  ]
}

export function SessionsTable({
  channelNames,
  cronTaskKeys,
  currentUserExternalIds,
  dateTimePreferences,
  isPlatformAdmin,
  memberNames,
  orgSlug,
  sessions,
}: SessionsTableProps) {
  const [filter, setFilter] = useState("")
  const nameMaps = useMemo(
    () => ({
      channels: new Map(Object.entries(channelNames)),
      members: new Map(Object.entries(memberNames)),
    }),
    [channelNames, memberNames],
  )

  const columns = useMemo(
    () =>
      createColumns({
        cronTaskKeys,
        currentUserExternalIds,
        dateTimePreferences,
        isPlatformAdmin,
        nameMaps,
        orgSlug,
      }),
    [
      cronTaskKeys,
      currentUserExternalIds,
      dateTimePreferences,
      isPlatformAdmin,
      nameMaps,
      orgSlug,
    ],
  )

  const filteredSessions = useMemo(() => {
    if (!filter.trim()) {
      return sessions
    }

    const query = filter.toLowerCase()

    return sessions.filter((session) => {
      const name = formatSessionName({
        displayName: session.displayName,
        label: session.label,
        nameMaps,
        originFrom: session.originFrom,
        sessionKey: session.sessionKey,
        subject: session.subject,
      }).toLowerCase()
      const status = session.status.toLowerCase()
      const provider = getProviderLabel(
        parseSessionKey(session.sessionKey).provider,
      ).toLowerCase()

      return (
        name.includes(query) ||
        status.includes(query) ||
        provider.includes(query)
      )
    })
  }, [filter, nameMaps, sessions])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ToolbarSearchInput
        aria-label="Search sessions"
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Search sessions..."
        value={filter}
      />
      <DataTable
        bodyClassName="align-middle"
        cellClassName="h-12 py-2.5"
        columns={columns}
        data={filteredSessions}
        emptyMessage="No sessions synced yet."
        fillAvailableSpace
        headClassName="h-11 px-4 text-sm font-medium text-foreground"
        headerClassName="sticky top-0 z-10 bg-background [&_tr]:border-0"
        rowClassName={cn("border-0 hover:bg-muted/50")}
        tableClassName="min-w-full table-fixed"
        viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
      />
    </div>
  )
}
