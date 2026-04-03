"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ConnectIcon } from "@hugeicons/core-free-icons";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import type { AgentCapability, AgentCapabilityDirection } from "@/tools/types";

export type CapabilityRow = AgentCapability & {
  sourceHref?: string | null;
  sourceIcon?: string | null;
  sourceLabel: string;
};

const directionBadgeVariant: Record<
  AgentCapabilityDirection,
  "default" | "secondary" | "outline"
> = {
  trigger: "default",
  tool: "secondary",
  read: "outline",
};

const directionLabels: Record<AgentCapabilityDirection, string> = {
  trigger: "Trigger",
  tool: "Tool",
  read: "Read",
};

const columns: ColumnDef<CapabilityRow>[] = [
  {
    accessorKey: "label",
    header: "Capability",
    size: 180,
    cell: ({ row }) => (
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {row.original.label}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    size: 320,
    cell: ({ row }) => (
      <span className="block max-w-[320px] truncate text-sm text-muted-foreground">
        {row.original.description}
      </span>
    ),
  },
  {
    accessorKey: "direction",
    header: "Type",
    size: 80,
    cell: ({ row }) => (
      <Badge variant={directionBadgeVariant[row.original.direction]}>
        {directionLabels[row.original.direction]}
      </Badge>
    ),
  },
  {
    accessorKey: "sourceLabel",
    header: "Source",
    size: 120,
    cell: ({ row }) => {
      const { sourceHref, sourceIcon, sourceLabel } = row.original;

      if (sourceHref) {
        return (
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
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
            ) : (
              <HugeiconsIcon
                className="size-4 shrink-0"
                icon={ConnectIcon}
              />
            )}
            {sourceLabel}
          </Link>
        );
      }

      return (
        <span className="text-sm text-muted-foreground">{sourceLabel}</span>
      );
    },
  },
];

export function CapabilitiesTable({ rows }: { rows: CapabilityRow[] }) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.sourceLabel.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Capabilities
          </h1>
          <p className="text-sm text-muted-foreground">
            Runtime capabilities your agent can use.{" "}
            <span className="font-medium text-foreground">{rows.length}</span>{" "}
            across native tools and integrations.
          </p>
        </div>
        <ToolbarSearchInput
          aria-label="Search capabilities"
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search capabilities..."
          value={filter}
        />
      </div>
      <DataTable
        bodyClassName="align-middle"
        cellClassName="h-12 py-2.5"
        columns={columns}
        data={filtered}
        emptyMessage="No capabilities available."
        fillAvailableSpace
        headClassName="h-11 px-4 text-sm font-medium text-foreground"
        headerClassName="[&_tr]:border-0 sticky top-0 z-10 bg-background"
        rowClassName="border-0 hover:bg-transparent"
        tableClassName="min-w-full table-fixed"
        tableContainerClassName="!overflow-visible"
        viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
      />
    </div>
  );
}
