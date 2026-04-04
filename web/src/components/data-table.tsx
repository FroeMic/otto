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
import { useRouter } from "next/navigation";
import * as React from "react";

import { ToolbarSearchInput } from "@/components/toolbar-search-input";
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
  getRowAriaLabel?: (row: TData) => string;
  getRowHref?: (row: TData) => string | null;
  headClassName?: string;
  headerClassName?: string;
  rowClassName?: string;
  searchKeys?: Array<Extract<keyof TData, string>>;
  searchInputClassName?: string;
  searchPlaceholder?: string;
  tableContainerClassName?: string;
  tableClassName?: string;
  toolbarClassName?: string;
  toolbarContentClassName?: string;
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
  getRowAriaLabel,
  getRowHref,
  headClassName,
  headerClassName,
  rowClassName,
  searchKeys = [],
  searchInputClassName,
  searchPlaceholder = "Search",
  tableContainerClassName,
  tableClassName,
  toolbarClassName,
  toolbarContentClassName,
  toolbar,
  viewportClassName,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
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

  function shouldIgnoreRowNavigation(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        "a, button, input, textarea, select, summary, [role='button'], [role='link']",
      ),
    );
  }

  function navigateToRow(href: string) {
    router.push(href);
  }

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
            "flex flex-col gap-3 sm:flex-row sm:items-center",
            searchKeys.length > 0 ? "sm:justify-between" : "sm:justify-start",
            toolbarClassName,
          )}
        >
          {searchKeys.length > 0 ? (
            <ToolbarSearchInput
              aria-label={searchPlaceholder}
              containerClassName={searchInputClassName}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              value={globalFilter}
            />
          ) : null}
          {toolbar ? (
            <div
              className={cn(
                "flex w-full flex-wrap items-center gap-2 sm:w-auto",
                searchKeys.length === 0 && "w-full",
                toolbarContentClassName,
              )}
            >
              {toolbar}
            </div>
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
                  <TableHead
                    className={headClassName}
                    key={header.id}
                    style={
                      header.column.columnDef.size
                        ? { width: header.getSize() }
                        : undefined
                    }
                  >
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
                <TableRow
                  aria-label={
                    getRowHref?.(row.original)
                      ? getRowAriaLabel?.(row.original)
                      : undefined
                  }
                  className={cn(
                    rowClassName,
                    getRowHref?.(row.original) &&
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  key={row.id}
                  onClick={(event) => {
                    const href = getRowHref?.(row.original);
                    if (!href || shouldIgnoreRowNavigation(event.target)) {
                      return;
                    }

                    navigateToRow(href);
                  }}
                  onKeyDown={(event) => {
                    const href = getRowHref?.(row.original);
                    if (
                      !href ||
                      shouldIgnoreRowNavigation(event.target) ||
                      (event.key !== "Enter" && event.key !== " ")
                    ) {
                      return;
                    }

                    event.preventDefault();
                    navigateToRow(href);
                  }}
                  role={getRowHref?.(row.original) ? "link" : undefined}
                  tabIndex={getRowHref?.(row.original) ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className={cellClassName} key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
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
