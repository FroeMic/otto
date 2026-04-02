"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { cn } from "@/lib/utils";
import type { AgentCapability, AgentCapabilityDirection } from "@/tools/types";

export type CapabilityRow = AgentCapability & {
  sourceLabel: string;
};

const directionLabels: Record<AgentCapabilityDirection, string> = {
  trigger: "Trigger",
  tool: "Tool",
  read: "Read",
};

const directionColors: Record<AgentCapabilityDirection, string> = {
  trigger: "bg-amber-100 text-amber-700",
  tool: "bg-blue-100 text-blue-700",
  read: "bg-emerald-100 text-emerald-700",
};

const columns: ColumnDef<CapabilityRow>[] = [
  {
    accessorKey: "label",
    header: "Capability",
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {row.original.label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {row.original.description}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "direction",
    header: "Type",
    cell: ({ row }) => (
      <span
        className={cn(
          "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
          directionColors[row.original.direction],
        )}
      >
        {directionLabels[row.original.direction]}
      </span>
    ),
  },
  {
    accessorKey: "sourceLabel",
    header: "Source",
    cell: ({ row }) => (
      <span className="text-sm text-foreground">
        {row.original.sourceLabel}
      </span>
    ),
  },
  {
    accessorKey: "openclawTool",
    header: "Runtime tool",
    cell: ({ row }) =>
      row.original.openclawTool ? (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
          {row.original.openclawTool}
        </code>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
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
        cellClassName="h-12 py-2"
        columns={columns}
        data={rows}
        emptyMessage="No capabilities available."
        fillAvailableSpace
        headClassName="h-11 px-4 text-sm font-medium text-foreground"
        headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
        rowClassName="hover:bg-transparent"
        searchKeys={["label", "sourceLabel"]}
        searchPlaceholder="Search capabilities..."
        tableClassName="min-w-full table-fixed"
        toolbarClassName="px-4 md:px-6"
        viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
      />
    </div>
  );
}
