import { ArrowsClockwiseIcon } from "@phosphor-icons/react"
import type {
  RuntimeDirectoryFileSnapshot,
  RuntimeDirectorySnapshot,
} from "@otto/feature-runtime-core/runtime-files/types"
import { useEffect, useState } from "react"

import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

import { RuntimeFilePreview } from "./RuntimeFilePreview"
import { RuntimeFileTree } from "./RuntimeFileTree"
import type {
  RuntimeFileSelection,
  RuntimeFileTreeNode,
} from "../types"

export interface RuntimeFileBrowserProps {
  buildDownloadUrl: (input: {
    disposition?: "attachment" | "inline"
    kind?: "directory" | "file"
    path: string
  }) => string
  emptyDirectoryMessage?: string
  explorerLabel: string
  hiddenPathPrefixes?: string[]
  hiddenPaths?: string[]
  isRefreshing?: boolean
  missingRootMessage: string
  onRefresh: () => void | Promise<unknown>
  rootPathFallback: string
  snapshot: RuntimeDirectorySnapshot
}

export function RuntimeFileBrowser({
  buildDownloadUrl,
  emptyDirectoryMessage = "This directory is currently empty.",
  explorerLabel,
  hiddenPathPrefixes = [],
  hiddenPaths = [],
  isRefreshing = false,
  missingRootMessage,
  onRefresh,
  rootPathFallback,
  snapshot,
}: RuntimeFileBrowserProps) {
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<RuntimeFileSelection | null>(
    null,
  )
  const visibleFiles = snapshot.files.filter(
    (file) =>
      !hiddenPaths.includes(file.path) &&
      !hiddenPathPrefixes.some((prefix) => file.path.startsWith(prefix)),
  )
  const tree = buildExplorerTree(visibleFiles)
  const visibleDirectoryPaths = collectVisibleDirectoryPaths(visibleFiles)
  const selectedFile =
    selectedNode?.kind === "file"
      ? (visibleFiles.find((file) => file.path === selectedNode.path) ?? null)
      : null
  const selectedDirectorySummary =
    selectedNode?.kind === "directory"
      ? summarizeDirectory({
          directoryPath: selectedNode.path,
          files: visibleFiles,
        })
      : null

  useEffect(() => {
    const nextVisibleFiles = snapshot.files.filter(
      (file) =>
        !hiddenPaths.includes(file.path) &&
        !hiddenPathPrefixes.some((prefix) => file.path.startsWith(prefix)),
    )
    const nextVisibleDirectoryPaths = collectVisibleDirectoryPaths(nextVisibleFiles)

    setExpandedDirectories(collectExpandedDirectories(nextVisibleFiles))
    setSelectedNode((current) => {
      if (
        current?.kind === "file" &&
        nextVisibleFiles.some((file) => file.path === current.path)
      ) {
        return current
      }

      if (
        current?.kind === "directory" &&
        nextVisibleDirectoryPaths.includes(current.path)
      ) {
        return current
      }

      const defaultFile =
        nextVisibleFiles.find((file) => isPreviewableImage(file)) ??
        nextVisibleFiles.find((file) => file.storageEncoding === "utf8_text") ??
        nextVisibleFiles[0] ??
        null

      if (!defaultFile) {
        return null
      }

      return {
        kind: "file",
        path: defaultFile.path,
      }
    })
  }, [hiddenPathPrefixes, hiddenPaths, snapshot.files, snapshot.rootExists, snapshot.rootPath])

  if (!snapshot.rootExists) {
    return (
      <Alert>
        <AlertTitle>Workspace directory not found</AlertTitle>
        <AlertDescription>
          {missingRootMessage} Expected root: {snapshot.rootPath || rootPathFallback}
        </AlertDescription>
      </Alert>
    )
  }

  if (visibleFiles.length === 0) {
    return (
      <Alert>
        <AlertTitle>No visible files yet</AlertTitle>
        <AlertDescription>{emptyDirectoryMessage}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <SettingsCard className="overflow-hidden">
        <SettingsRow>
          <SettingsRowLabel>
            <SettingsRowTitle>{explorerLabel}</SettingsRowTitle>
            <SettingsRowDescription>
              Browse the runtime file tree.
            </SettingsRowDescription>
          </SettingsRowLabel>
          <Button
            className="shrink-0"
            onClick={() => {
              void onRefresh()
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <ArrowsClockwiseIcon
              className={isRefreshing ? "size-4 animate-spin" : "size-4"}
            />
            Refresh
          </Button>
        </SettingsRow>
        <ScrollArea className="h-[36rem]">
          <RuntimeFileTree
            buildDownloadUrl={buildDownloadUrl}
            expandedDirectories={expandedDirectories}
            onDirectoryToggle={(path) =>
              setExpandedDirectories((current) =>
                current.includes(path)
                  ? current.filter((entry) => entry !== path)
                  : [...current, path],
              )
            }
            onNodeSelect={setSelectedNode}
            selectedNode={selectedNode}
            tree={tree}
          />
        </ScrollArea>
      </SettingsCard>

      <SettingsCard className="overflow-hidden">
        <RuntimeFilePreview
          buildDownloadUrl={buildDownloadUrl}
          directorySummary={selectedDirectorySummary}
          file={selectedFile}
          selectedNode={selectedNode}
        />
      </SettingsCard>
    </div>
  )
}

function buildExplorerTree(
  files: RuntimeDirectoryFileSnapshot[],
): RuntimeFileTreeNode[] {
  const root = createMutableDirectoryNode("", "")

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean)
    const fileName = segments.pop()

    if (!fileName) {
      continue
    }

    let currentDirectory = root
    let currentPath = ""

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment

      let nextDirectory = currentDirectory.directories.get(segment)

      if (!nextDirectory) {
        nextDirectory = createMutableDirectoryNode(segment, currentPath)
        currentDirectory.directories.set(segment, nextDirectory)
      }

      currentDirectory = nextDirectory
    }

    currentDirectory.files.push(file)
  }

  return convertMutableDirectoryNode(root)
}

function collectExpandedDirectories(files: RuntimeDirectoryFileSnapshot[]) {
  const expanded = new Set<string>()

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean)
    let currentPath = ""

    for (const segment of segments.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      expanded.add(currentPath)
    }
  }

  return Array.from(expanded)
}

function collectVisibleDirectoryPaths(files: RuntimeDirectoryFileSnapshot[]) {
  const paths = new Set<string>()

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean)
    let currentPath = ""

    for (const segment of segments.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      paths.add(currentPath)
    }
  }

  return Array.from(paths)
}

interface MutableDirectoryNode {
  directories: Map<string, MutableDirectoryNode>
  files: RuntimeDirectoryFileSnapshot[]
  name: string
  path: string
}

function createMutableDirectoryNode(
  name: string,
  path: string,
): MutableDirectoryNode {
  return {
    directories: new Map<string, MutableDirectoryNode>(),
    files: [] as RuntimeDirectoryFileSnapshot[],
    name,
    path,
  }
}

function convertMutableDirectoryNode(node: MutableDirectoryNode): RuntimeFileTreeNode[] {
  const childDirectories = Array.from(node.directories.values())
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((directory) => ({
      children: convertMutableDirectoryNode(directory),
      kind: "directory" as const,
      name: directory.name,
      path: directory.path,
    }))
  const childFiles = [...node.files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => ({
      file,
      kind: "file" as const,
      name: file.path.split("/").pop() ?? file.path,
      path: file.path,
    }))

  return [...childDirectories, ...childFiles]
}

function isPreviewableImage(file: RuntimeDirectoryFileSnapshot) {
  return file.contentType?.startsWith("image/") ?? false
}

function summarizeDirectory(input: {
  directoryPath: string
  files: RuntimeDirectoryFileSnapshot[]
}) {
  const directoryPrefix = `${input.directoryPath}/`
  const files = input.files.filter((file) =>
    file.path.startsWith(directoryPrefix),
  )

  return {
    fileCount: files.length,
    totalSizeBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
  }
}
