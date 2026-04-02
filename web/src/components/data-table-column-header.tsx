"use client";

import type { Column } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableColumnHeaderProps<TData, TValue> = {
  className?: string;
  column: Column<TData, TValue>;
  title: string;
};

export function DataTableColumnHeader<TData, TValue>({
  className,
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn(className)}>{title}</span>;
  }

  const sortDirection = column.getIsSorted();
  const sortIndicator =
    sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : null;

  return (
    <Button
      className={cn("h-auto px-0 py-0 font-medium text-foreground", className)}
      onClick={() => column.toggleSorting(sortDirection === "asc")}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span>{title}</span>
      <span className="ml-1 text-xs text-muted-foreground">
        {sortIndicator ?? ""}
      </span>
    </Button>
  );
}
