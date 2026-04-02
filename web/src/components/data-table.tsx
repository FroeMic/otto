"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData, TValue> = {
  bodyClassName?: string;
  cellClassName?: string;
  className?: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  fillAvailableSpace?: boolean;
  headClassName?: string;
  headerClassName?: string;
  rowClassName?: string;
  searchKeys?: Array<Extract<keyof TData, string>>;
  searchInputClassName?: string;
  searchPlaceholder?: string;
  tableContainerClassName?: string;
  tableClassName?: string;
  toolbarClassName?: string;
  toolbar?: React.ReactNode;
  viewportClassName?: string;
};

export function DataTable<TData, TValue>({
  bodyClassName,
  cellClassName,
  className,
  columns,
  data,
  emptyMessage = "No results found.",
  fillAvailableSpace = false,
  headClassName,
  headerClassName,
  rowClassName,
  searchKeys = [],
  searchInputClassName,
  searchPlaceholder = "Search",
  tableContainerClassName,
  tableClassName,
  toolbarClassName,
  toolbar,
  viewportClassName,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const normalizedFilter = String(filterValue ?? "")
        .trim()
        .toLowerCase();

      if (!normalizedFilter || searchKeys.length === 0) {
        return true;
      }

      return searchKeys.some((key) => {
        const value = row.original[key];

        return String(value ?? "")
          .toLowerCase()
          .includes(normalizedFilter);
      });
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    state: {
      globalFilter,
      sorting,
    },
  });

  const showToolbar = searchKeys.length > 0 || toolbar;

  return (
    <div
      className={cn(
        "w-full",
        fillAvailableSpace && "flex min-h-0 min-w-0 flex-1 flex-col",
        className,
      )}
    >
      {showToolbar ? (
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            toolbarClassName,
          )}
        >
          {searchKeys.length > 0 ? (
            <Input
              className={cn("h-11 w-full max-w-md", searchInputClassName)}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              value={globalFilter}
            />
          ) : (
            <div />
          )}
          {toolbar ? (
            <div className="flex items-center gap-2">{toolbar}</div>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          fillAvailableSpace && "min-h-0 min-w-0 flex-1 overflow-auto",
          viewportClassName,
        )}
      >
        <Table
          className={tableClassName}
          containerClassName={cn(
            fillAvailableSpace && "h-full",
            tableContainerClassName,
          )}
        >
          <TableHeader className={headerClassName}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead className={headClassName} key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={bodyClassName}>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow className={rowClassName} key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className={cellClassName} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-28 text-center text-sm text-muted-foreground"
                  colSpan={columns.length}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
