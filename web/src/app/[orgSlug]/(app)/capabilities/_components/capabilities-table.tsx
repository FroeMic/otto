"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ConnectIcon } from "@hugeicons/core-free-icons";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
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
  trigger: "outline",
  tool: "secondary",
  read: "default",
};

const directionLabels: Record<AgentCapabilityDirection, string> = {
  trigger: "Trigger",
  tool: "Tool",
  read: "Read",
};

function SourceIcon({ icon }: { icon: string | null | undefined }) {
  if (!icon) return null;

  return (
    <Image
      alt=""
      className="size-4 shrink-0"
      height={16}
      src={icon}
      width={16}
    />
  );
}

const columns: ColumnDef<CapabilityRow>[] = [
  {
    accessorKey: "label",
    header: "Capability",
    cell: ({ row }) => (
      <span className="text-sm font-medium text-foreground">
        {row.original.label}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.description}
      </span>
    ),
  },
  {
    accessorKey: "direction",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant={directionBadgeVariant[row.original.direction]}>
        {directionLabels[row.original.direction]}
      </Badge>
    ),
  },
  {
    accessorKey: "sourceLabel",
    header: "Source",
    cell: ({ row }) => {
      const { sourceHref, sourceIcon, sourceLabel } = row.original;

      if (sourceHref) {
        return (
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline"
            href={sourceHref}
          >
            {sourceIcon ? (
              <SourceIcon icon={sourceIcon} />
            ) : (
              <HugeiconsIcon
                className="size-4 shrink-0 text-muted-foreground"
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
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1 px-4 pt-2 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Capabilities</h1>
        <p className="text-sm text-muted-foreground">
          Runtime capabilities your agent can use.{" "}
          <span className="font-medium text-foreground">{rows.length}</span>{" "}
          across native tools and integrations.
        </p>
      </div>
      <DataTable
        bodyClassName="align-top"
        cellClassName="h-11 py-2"
        columns={columns}
        data={rows}
        emptyMessage="No capabilities available."
        fillAvailableSpace
        headClassName="h-11 px-4 text-sm font-medium text-foreground"
        headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
        rowClassName="hover:bg-transparent"
        searchInputClassName="h-11 rounded-lg border bg-input/50 px-3 text-sm"
        searchKeys={["label", "sourceLabel"]}
        searchPlaceholder="Search capabilities..."
        tableClassName="min-w-full table-fixed"
        toolbarClassName="px-4 pb-4 md:px-6"
        viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
      />
    </div>
  );
}
