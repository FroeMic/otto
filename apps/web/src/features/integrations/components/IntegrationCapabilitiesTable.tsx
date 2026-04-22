import { DotsThree } from "@phosphor-icons/react"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { useMemo, useTransition } from "react"
import { toast } from "sonner"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { updateWorkspaceIntegrationCapabilityPolicy } from "../api/integrations"
import type { WorkspaceIntegrationCapabilityRow } from "../types"

export interface IntegrationCapabilitiesTableProps {
  integrationKey: string
  onUpdated: () => void
  orgSlug: string
  rows: WorkspaceIntegrationCapabilityRow[]
}

const DEFAULT_CAPABILITY_SORTING: SortingState = [
  { desc: false, id: "commandGroup" },
  { desc: false, id: "capabilityType" },
  { desc: false, id: "effect" },
]

const capabilityStatusBadgeVariant: Record<
  WorkspaceIntegrationCapabilityRow["status"],
  "default" | "destructive" | "secondary"
> = {
  disabled: "secondary",
  enabled: "default",
  needs_attention: "destructive",
}

const capabilityTypeBadgeVariant: Record<
  WorkspaceIntegrationCapabilityRow["capabilityType"],
  "default" | "outline"
> = {
  command: "outline",
  trigger: "default",
}

const effectSortOrder: Record<
  NonNullable<WorkspaceIntegrationCapabilityRow["effect"]>,
  number
> = {
  read: 0,
  write: 1,
}

const capabilityTypeSortOrder: Record<
  WorkspaceIntegrationCapabilityRow["capabilityType"],
  number
> = {
  command: 0,
  trigger: 1,
}

interface CapabilityActionsCellProps {
  integrationKey: string
  onUpdated: () => void
  orgSlug: string
  row: WorkspaceIntegrationCapabilityRow
}

function formatCapabilityStatus(
  status: WorkspaceIntegrationCapabilityRow["status"],
) {
  if (status === "needs_attention") {
    return "Needs attention"
  }

  return status === "enabled" ? "Enabled" : "Disabled"
}

function formatCapabilityType(
  type: WorkspaceIntegrationCapabilityRow["capabilityType"],
) {
  return type === "trigger" ? "Trigger" : "Command"
}

function formatCapabilityEffect(
  effect: WorkspaceIntegrationCapabilityRow["effect"],
) {
  if (effect === "read") {
    return "Read"
  }

  if (effect === "write") {
    return "Write"
  }

  return "—"
}

function formatCommandGroup(group: string | null) {
  if (!group) {
    return "—"
  }

  return group
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function CapabilityActionsCell({
  integrationKey,
  onUpdated,
  orgSlug,
  row,
}: CapabilityActionsCellProps) {
  const [isPending, startTransition] = useTransition()

  if (!row.userControllable) {
    return (
      <span className="text-sm text-muted-foreground">
        Not configurable here
      </span>
    )
  }

  const nextPolicy = row.policy?.policy === "block" ? "allow" : "block"
  const actionLabel = nextPolicy === "block" ? "Disable" : "Enable"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Open actions for ${row.label}`}
            className="text-muted-foreground"
            disabled={isPending}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <DotsThree className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            startTransition(() => {
              void updateWorkspaceIntegrationCapabilityPolicy({
                capabilityKey: row.capabilityKey,
                integrationKey,
                orgSlug,
                policy: nextPolicy,
              })
                .then(() => {
                  toast.success(
                    nextPolicy === "block"
                      ? `${row.label} disabled.`
                      : `${row.label} enabled.`,
                  )
                  onUpdated()
                })
                .catch((error) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Capability policy update failed.",
                  )
                })
            })
          }}
        >
          {actionLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function createColumns(input: {
  integrationKey: string
  onUpdated: () => void
  orgSlug: string
}): Array<ColumnDef<WorkspaceIntegrationCapabilityRow>> {
  return [
    {
      accessorKey: "label",
      cell: ({ row }) => (
        <span className="block truncate text-sm font-medium text-foreground">
          {row.original.label}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Capability" />
      ),
      size: 220,
    },
    {
      accessorKey: "capabilityType",
      cell: ({ row }) => (
        <Badge
          variant={capabilityTypeBadgeVariant[row.original.capabilityType]}
        >
          {formatCapabilityType(row.original.capabilityType)}
        </Badge>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      size: 120,
      sortingFn: (left, right) =>
        capabilityTypeSortOrder[left.original.capabilityType] -
        capabilityTypeSortOrder[right.original.capabilityType],
    },
    {
      accessorKey: "commandGroup",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatCommandGroup(row.original.commandGroup)}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Group" />
      ),
      size: 160,
      sortingFn: (left, right) =>
        formatCommandGroup(left.original.commandGroup).localeCompare(
          formatCommandGroup(right.original.commandGroup),
        ),
    },
    {
      accessorKey: "effect",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatCapabilityEffect(row.original.effect)}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Effect" />
      ),
      size: 120,
      sortingFn: (left, right) =>
        (left.original.effect
          ? effectSortOrder[left.original.effect]
          : Number.POSITIVE_INFINITY) -
        (right.original.effect
          ? effectSortOrder[right.original.effect]
          : Number.POSITIVE_INFINITY),
    },
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <Badge variant={capabilityStatusBadgeVariant[row.original.status]}>
          {formatCapabilityStatus(row.original.status)}
        </Badge>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      size: 140,
    },
    {
      accessorKey: "reason",
      cell: ({ row }) => (
        <span className="block truncate text-sm text-muted-foreground">
          {row.original.reason ?? "—"}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reason" />
      ),
      size: 320,
    },
    {
      cell: ({ row }) => (
        <CapabilityActionsCell
          integrationKey={input.integrationKey}
          onUpdated={input.onUpdated}
          orgSlug={input.orgSlug}
          row={row.original}
        />
      ),
      header: "Actions",
      id: "actions",
      size: 96,
    },
  ]
}

export function IntegrationCapabilitiesTable({
  integrationKey,
  onUpdated,
  orgSlug,
  rows,
}: IntegrationCapabilitiesTableProps) {
  const columns = useMemo(
    () => createColumns({ integrationKey, onUpdated, orgSlug }),
    [integrationKey, onUpdated, orgSlug],
  )

  return (
    <DataTable
      bodyClassName="align-middle"
      cellClassName="h-12 px-4 py-2"
      columns={columns}
      data={rows}
      emptyMessage="No capabilities available."
      fillAvailableSpace
      headClassName="px-4 text-sm font-medium text-foreground"
      headerClassName="[&_tr]:border-0 sticky top-0 z-10 bg-background"
      initialSorting={DEFAULT_CAPABILITY_SORTING}
      rowClassName="border-0 hover:bg-transparent"
      searchKeys={["label", "description", "commandGroup", "reason"]}
      searchPlaceholder="Search capabilities..."
      tableClassName="min-w-full table-fixed"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  )
}
