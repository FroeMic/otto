"use client"

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useState } from "react"

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
  tableClassName,
  toolbar,
  toolbarClassName,
  viewportClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const table = useReactTable({
    columns,
    data,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
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
      {toolbar ? <div className={toolbarClassName}>{toolbar}</div> : null}
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
