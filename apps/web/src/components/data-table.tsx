"use client"

import {
  flexRender,
  getFilteredRowModel,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface DataTableProps<TData, TValue> {
  bodyClassName?: string
  cellClassName?: string
  className?: string
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  emptyMessage?: string
  fillAvailableSpace?: boolean
  headClassName?: string
  headerClassName?: string
  initialSorting?: SortingState
  rowClassName?: string
  searchKeys?: string[]
  searchPlaceholder?: string
  tableClassName?: string
  toolbar?: React.ReactNode
  toolbarClassName?: string
  viewportClassName?: string
}

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
  initialSorting,
  rowClassName,
  searchKeys,
  searchPlaceholder = "Search",
  tableClassName,
  toolbar,
  toolbarClassName,
  viewportClassName,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const table = useReactTable({
    columns,
    data,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      if (!Array.isArray(searchKeys) || searchKeys.length === 0) {
        return true
      }

      const normalizedFilter = String(filterValue).trim().toLowerCase()

      if (!normalizedFilter) {
        return true
      }

      return searchKeys.some((searchKey) => {
        const keyParts = searchKey.split(".")
        let currentValue: unknown = row.original

        for (const keyPart of keyParts) {
          if (!currentValue || typeof currentValue !== "object") {
            return false
          }

          currentValue = (currentValue as Record<string, unknown>)[keyPart]
        }

        return String(currentValue ?? "")
          .toLowerCase()
          .includes(normalizedFilter)
      })
    },
    onSortingChange: setSorting,
    state: {
      globalFilter,
      sorting,
    },
  })

  return (
    <div
      className={cn(
        "w-full",
        fillAvailableSpace && "flex min-h-0 min-w-0 flex-1 flex-col",
        className,
      )}
    >
      {toolbar || (Array.isArray(searchKeys) && searchKeys.length > 0) ? (
        <div className={toolbarClassName}>
          <div className="flex w-full min-w-0 items-center gap-3">
            {Array.isArray(searchKeys) && searchKeys.length > 0 ? (
              <Input
                className="max-w-sm"
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder={searchPlaceholder}
                value={globalFilter}
              />
            ) : null}
            {toolbar ? <div className="flex min-w-0 flex-1">{toolbar}</div> : null}
          </div>
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
          containerClassName={fillAvailableSpace ? "h-full" : undefined}
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
                <TableRow className={rowClassName} key={row.id}>
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
  )
}
