"use client";

import type { Column } from "@tanstack/react-table";

import { Button } from "./ui/button";
import { cn } from "../lib/utils";

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
    sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "\u00a0";

  return (
    <Button
      className={cn(
        "h-auto rounded-md px-2 py-1 font-medium text-foreground",
        sortDirection && "bg-muted text-foreground",
        className,
      )}
      onClick={() => {
        if (sortDirection === "asc") {
          column.toggleSorting(true);
          return;
        }

        if (sortDirection === "desc") {
          column.toggleSorting(false);
          return;
        }

        column.toggleSorting(false);
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span>{title}</span>
      <span
        className={cn(
          "inline-flex w-4 justify-center text-xs",
          sortDirection ? "text-foreground" : "text-transparent",
        )}
      >
        {sortIndicator}
      </span>
    </Button>
  );
}
