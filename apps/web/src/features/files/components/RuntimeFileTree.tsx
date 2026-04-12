import {
  CaretDownIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { RuntimeFileSelection, RuntimeFileTreeNode } from "../types"

export interface RuntimeFileTreeProps {
  buildDownloadUrl: (input: {
    disposition?: "attachment" | "inline"
    kind?: "directory" | "file"
    path: string
  }) => string
  expandedDirectories: string[]
  onDirectoryToggle: (path: string) => void
  onNodeSelect: (selection: RuntimeFileSelection) => void
  selectedNode: RuntimeFileSelection | null
  tree: RuntimeFileTreeNode[]
}

export function RuntimeFileTree({
  buildDownloadUrl,
  expandedDirectories,
  onDirectoryToggle,
  onNodeSelect,
  selectedNode,
  tree,
}: RuntimeFileTreeProps) {
  return (
    <div className="flex flex-col">
      {tree.map((node) => (
        <RuntimeFileTreeNodeRow
          buildDownloadUrl={buildDownloadUrl}
          expandedDirectories={expandedDirectories}
          key={node.path}
          node={node}
          onDirectoryToggle={onDirectoryToggle}
          onNodeSelect={onNodeSelect}
          selectedNode={selectedNode}
        />
      ))}
    </div>
  )
}

interface RuntimeFileTreeNodeRowProps {
  buildDownloadUrl: (input: {
    disposition?: "attachment" | "inline"
    kind?: "directory" | "file"
    path: string
  }) => string
  depth?: number
  expandedDirectories: string[]
  node: RuntimeFileTreeNode
  onDirectoryToggle: (path: string) => void
  onNodeSelect: (selection: RuntimeFileSelection) => void
  selectedNode: RuntimeFileSelection | null
}

function RuntimeFileTreeNodeRow({
  buildDownloadUrl,
  depth = 0,
  expandedDirectories,
  node,
  onDirectoryToggle,
  onNodeSelect,
  selectedNode,
}: RuntimeFileTreeNodeRowProps) {
  const isDirectoryExpanded =
    node.kind === "directory" && expandedDirectories.includes(node.path)
  const isSelected =
    selectedNode?.kind === node.kind && selectedNode.path === node.path
  const downloadUrl = buildDownloadUrl({
    disposition: "attachment",
    kind: node.kind,
    path: node.path,
  })

  if (node.kind === "directory") {
    return (
      <div>
        <div
          className={cn(
            "group flex items-center gap-2 px-4 py-2 transition-colors hover:bg-muted/40",
            depth > 0 && "pl-6",
            isSelected && "bg-muted/60 text-foreground",
          )}
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
            onClick={() => {
              onNodeSelect({
                kind: "directory",
                path: node.path,
              })
              onDirectoryToggle(node.path)
            }}
            type="button"
          >
            {isDirectoryExpanded ? (
              <CaretDownIcon className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            {isDirectoryExpanded ? (
              <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          <a
            className={cn(
              buttonVariants({
                size: "icon",
                variant: "ghost",
              }),
              "size-8 shrink-0 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
            )}
            href={downloadUrl}
            title="Download folder as zip"
          >
            <DownloadSimpleIcon className="size-4" />
            <span className="sr-only">Download folder as zip</span>
          </a>
        </div>

        {isDirectoryExpanded ? (
          <div>
            {node.children.map((child) => (
              <RuntimeFileTreeNodeRow
                buildDownloadUrl={buildDownloadUrl}
                depth={depth + 1}
                expandedDirectories={expandedDirectories}
                key={child.path}
                node={child}
                onDirectoryToggle={onDirectoryToggle}
                onNodeSelect={onNodeSelect}
                selectedNode={selectedNode}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-4 py-2 transition-colors hover:bg-muted/40",
        depth > 0 && "pl-10",
        isSelected && "bg-muted/60 text-foreground",
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
        onClick={() =>
          onNodeSelect({
            kind: "file",
            path: node.path,
          })
        }
        type="button"
      >
        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
      <a
        className={cn(
          buttonVariants({
            size: "icon",
            variant: "ghost",
          }),
          "size-8 shrink-0 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
        )}
        href={downloadUrl}
        title="Download file"
      >
        <DownloadSimpleIcon className="size-4" />
        <span className="sr-only">Download file</span>
      </a>
    </div>
  )
}
