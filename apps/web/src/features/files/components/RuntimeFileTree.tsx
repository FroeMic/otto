import {
  CaretDownIcon,
  CaretRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import type { RuntimeFileTreeNode } from "../types"

export interface RuntimeFileTreeProps {
  expandedDirectories: string[]
  onDirectoryToggle: (path: string) => void
  onFileSelect: (path: string) => void
  selectedFilePath: string | null
  tree: RuntimeFileTreeNode[]
}

export function RuntimeFileTree({
  expandedDirectories,
  onDirectoryToggle,
  onFileSelect,
  selectedFilePath,
  tree,
}: RuntimeFileTreeProps) {
  return (
    <div className="flex flex-col">
      {tree.map((node) => (
        <RuntimeFileTreeNodeRow
          expandedDirectories={expandedDirectories}
          key={node.path}
          node={node}
          onDirectoryToggle={onDirectoryToggle}
          onFileSelect={onFileSelect}
          selectedFilePath={selectedFilePath}
        />
      ))}
    </div>
  )
}

interface RuntimeFileTreeNodeRowProps {
  depth?: number
  expandedDirectories: string[]
  node: RuntimeFileTreeNode
  onDirectoryToggle: (path: string) => void
  onFileSelect: (path: string) => void
  selectedFilePath: string | null
}

function RuntimeFileTreeNodeRow({
  depth = 0,
  expandedDirectories,
  node,
  onDirectoryToggle,
  onFileSelect,
  selectedFilePath,
}: RuntimeFileTreeNodeRowProps) {
  const isDirectoryExpanded =
    node.kind === "directory" && expandedDirectories.includes(node.path)
  const isSelected = node.kind === "file" && selectedFilePath === node.path

  if (node.kind === "directory") {
    return (
      <div>
        <button
          className={cn(
            "flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/40",
            depth > 0 && "pl-6",
          )}
          onClick={() => onDirectoryToggle(node.path)}
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

        {isDirectoryExpanded ? (
          <div>
            {node.children.map((child) => (
              <RuntimeFileTreeNodeRow
                depth={depth + 1}
                expandedDirectories={expandedDirectories}
                key={child.path}
                node={child}
                onDirectoryToggle={onDirectoryToggle}
                onFileSelect={onFileSelect}
                selectedFilePath={selectedFilePath}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/40",
        depth > 0 && "pl-10",
        isSelected && "bg-muted/60 text-foreground",
      )}
      onClick={() => onFileSelect(node.path)}
      type="button"
    >
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

