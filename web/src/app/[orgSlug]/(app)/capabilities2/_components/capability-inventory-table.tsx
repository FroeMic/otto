"use client";

import { ArrowsClockwise, DotsThree } from "@phosphor-icons/react/ssr";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export type CapabilityInventoryRow = {
  capabilityKey: string;
  capabilityType: "command" | "trigger";
  commandGroup: string | null;
  description: string;
  effect: "read" | "write" | null;
  label: string;
  policy: { policy: "allow" | "block" } | null;
  policyEndpoint: string | null;
  reason: string | null;
  searchText: string;
  sourceHref: string | null;
  sourceIcon: string | null;
  sourceLabel: string;
  sourceType: "core" | "integration";
  status: "disabled" | "enabled" | "needs_attention";
  userControllable: boolean;
};

type CapabilityTypeFilter = "all" | "commands" | "triggers";

const CAPABILITY_TYPE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Triggers", value: "triggers" },
  { label: "Commands", value: "commands" },
] as const satisfies Array<{ label: string; value: CapabilityTypeFilter }>;

const capabilityStatusBadgeVariant: Record<
  CapabilityInventoryRow["status"],
  "default" | "destructive" | "secondary"
> = {
  disabled: "secondary",
  enabled: "default",
  needs_attention: "destructive",
};

const capabilityTypeBadgeVariant: Record<
  CapabilityInventoryRow["capabilityType"],
  "default" | "outline"
> = {
  command: "outline",
  trigger: "default",
};

const effectSortOrder: Record<
  NonNullable<CapabilityInventoryRow["effect"]>,
  number
> = {
  read: 0,
  write: 1,
};

const capabilityTypeSortOrder: Record<
  CapabilityInventoryRow["capabilityType"],
  number
> = {
  command: 0,
  trigger: 1,
};

const DEFAULT_CAPABILITY_SORTING: SortingState = [
  { desc: false, id: "commandGroup" },
  { desc: false, id: "capabilityType" },
  { desc: false, id: "effect" },
];

function formatCapabilityStatus(status: CapabilityInventoryRow["status"]) {
  if (status === "needs_attention") {
    return "Needs attention";
  }

  return status === "enabled" ? "Enabled" : "Disabled";
}

function formatCapabilityType(type: CapabilityInventoryRow["capabilityType"]) {
  return type === "trigger" ? "Trigger" : "Command";
}

function formatCapabilityEffect(effect: CapabilityInventoryRow["effect"]) {
  if (effect === "read") {
    return "Read";
  }

  if (effect === "write") {
    return "Write";
  }

  return "—";
}

function formatCommandGroup(group: string | null) {
  if (!group) {
    return "—";
  }

  return group
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseCapabilityTypeFilter(value: string | null): CapabilityTypeFilter {
  if (value === "commands" || value === "triggers") {
    return value;
  }

  return "all";
}

function CapabilityActionsCell({ row }: { row: CapabilityInventoryRow }) {
  const router = useRouter();
  const [pendingAction, startTransition] = React.useTransition();

  const policyEndpoint = row.policyEndpoint;

  if (!policyEndpoint || !row.userControllable) {
    return (
      <span className="text-sm text-muted-foreground">
        {row.userControllable ? "—" : "Not configurable here"}
      </span>
    );
  }

  const nextPolicy = row.policy?.policy === "block" ? "allow" : "block";
  const actionLabel = nextPolicy === "block" ? "Disable" : "Enable";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Open actions for ${row.label}`}
            className="text-muted-foreground"
            disabled={pendingAction}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        {pendingAction ? (
          <ArrowsClockwise className="animate-spin" />
        ) : (
          <DotsThree />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            startTransition(async () => {
              try {
                const response = await fetch(policyEndpoint, {
                  body: JSON.stringify({
                    policy: nextPolicy,
                  }),
                  headers: {
                    "Content-Type": "application/json",
                  },
                  method: "POST",
                });
                const payload = (await response.json().catch(() => null)) as {
                  message?: string;
                } | null;

                if (!response.ok) {
                  throw new Error(
                    payload?.message ??
                      `Capability policy update failed with status ${response.status}.`,
                  );
                }

                toast.success(
                  nextPolicy === "block"
                    ? `${row.label} disabled.`
                    : `${row.label} enabled.`,
                );
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Capability policy update failed.",
                );
              }
            });
          }}
        >
          {actionLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function createColumns(
  showSource: boolean,
): Array<ColumnDef<CapabilityInventoryRow>> {
  const columns: Array<ColumnDef<CapabilityInventoryRow>> = [
    {
      accessorKey: "label",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Capability" />
      ),
      size: 220,
      cell: ({ row }) => (
        <span className="block truncate text-sm font-medium text-foreground">
          {row.original.label}
        </span>
      ),
    },
    {
      accessorKey: "capabilityType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      sortingFn: (left, right) =>
        capabilityTypeSortOrder[left.original.capabilityType] -
        capabilityTypeSortOrder[right.original.capabilityType],
      size: 120,
      cell: ({ row }) => (
        <Badge
          variant={capabilityTypeBadgeVariant[row.original.capabilityType]}
        >
          {formatCapabilityType(row.original.capabilityType)}
        </Badge>
      ),
    },
    {
      accessorKey: "commandGroup",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Group" />
      ),
      sortingFn: (left, right) =>
        formatCommandGroup(left.original.commandGroup).localeCompare(
          formatCommandGroup(right.original.commandGroup),
        ),
      size: 160,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatCommandGroup(row.original.commandGroup)}
        </span>
      ),
    },
    {
      accessorKey: "effect",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Effect" />
      ),
      sortingFn: (left, right) =>
        (left.original.effect
          ? effectSortOrder[left.original.effect]
          : Number.POSITIVE_INFINITY) -
        (right.original.effect
          ? effectSortOrder[right.original.effect]
          : Number.POSITIVE_INFINITY),
      size: 120,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatCapabilityEffect(row.original.effect)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      size: 140,
      cell: ({ row }) => (
        <Badge variant={capabilityStatusBadgeVariant[row.original.status]}>
          {formatCapabilityStatus(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "reason",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reason" />
      ),
      size: 320,
      cell: ({ row }) => (
        <span className="block truncate text-sm text-muted-foreground">
          {row.original.reason ?? "—"}
        </span>
      ),
    },
  ];

  if (showSource) {
    columns.push({
      accessorKey: "sourceLabel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Source" />
      ),
      size: 180,
      cell: ({ row }) => {
        const { sourceHref, sourceIcon, sourceLabel } = row.original;

        if (!sourceHref) {
          return (
            <span className="text-sm text-muted-foreground">{sourceLabel}</span>
          );
        }

        return (
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
            href={sourceHref}
          >
            {sourceIcon ? (
              <Image
                alt=""
                className="size-4 shrink-0"
                height={16}
                src={sourceIcon}
                width={16}
              />
            ) : null}
            <span className="truncate">{sourceLabel}</span>
          </Link>
        );
      },
    });
  }

  columns.push({
    id: "actions",
    header: "Actions",
    size: 96,
    cell: ({ row }) => <CapabilityActionsCell row={row.original} />,
  });

  return columns;
}

export function CapabilityInventoryTable({
  rows,
  showSource = true,
}: {
  rows: CapabilityInventoryRow[];
  showSource?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseCapabilityTypeFilter(searchParams.get("type"));

  const filteredRows = React.useMemo(() => {
    if (filter === "commands") {
      return rows.filter((row) => row.capabilityType === "command");
    }

    if (filter === "triggers") {
      return rows.filter((row) => row.capabilityType === "trigger");
    }

    return rows;
  }, [filter, rows]);

  const columns = React.useMemo(() => createColumns(showSource), [showSource]);

  function updateFilter(nextFilter: CapabilityTypeFilter) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextFilter === "all") {
      params.delete("type");
    } else {
      params.set("type", nextFilter);
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
      emptyMessage="No capabilities available."
      fillAvailableSpace
      initialSorting={DEFAULT_CAPABILITY_SORTING}
      headClassName="px-4 text-sm font-medium text-foreground"
      headerClassName="[&_tr]:border-0 sticky top-0 z-10 bg-background"
      rowClassName="border-0 hover:bg-transparent"
      searchKeys={["searchText"]}
      searchPlaceholder="Search capabilities..."
      tableClassName="min-w-full table-fixed"
      toolbar={
        <NativeSelect
          aria-label="Filter capabilities by type"
          className="min-w-40"
          onChange={(event) =>
            updateFilter(event.target.value as CapabilityTypeFilter)
          }
          value={filter}
        >
          {CAPABILITY_TYPE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      }
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  );
}
