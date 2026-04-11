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
import type { RuntimeFileTreeNode } from "../types"

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
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const visibleFiles = snapshot.files.filter(
    (file) =>
      !hiddenPaths.includes(file.path) &&
      !hiddenPathPrefixes.some((prefix) => file.path.startsWith(prefix)),
  )
  const tree = buildExplorerTree(visibleFiles)
  const selectedFile =
    visibleFiles.find((file) => file.path === selectedFilePath) ??
    visibleFiles.find((file) => isPreviewableImage(file)) ??
    visibleFiles.find((file) => file.storageEncoding === "utf8_text") ??
    visibleFiles[0] ??
    null

  useEffect(() => {
    const nextVisibleFiles = snapshot.files.filter(
      (file) =>
        !hiddenPaths.includes(file.path) &&
        !hiddenPathPrefixes.some((prefix) => file.path.startsWith(prefix)),
    )

    setExpandedDirectories(collectExpandedDirectories(nextVisibleFiles))
    setSelectedFilePath(
      nextVisibleFiles.find((file) => isPreviewableImage(file))?.path ??
        nextVisibleFiles.find((file) => file.storageEncoding === "utf8_text")
          ?.path ??
        nextVisibleFiles[0]?.path ??
        null,
    )
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
            expandedDirectories={expandedDirectories}
            onDirectoryToggle={(path) =>
              setExpandedDirectories((current) =>
                current.includes(path)
                  ? current.filter((entry) => entry !== path)
                  : [...current, path],
              )
            }
            onFileSelect={setSelectedFilePath}
            selectedFilePath={selectedFile?.path ?? null}
            tree={tree}
          />
        </ScrollArea>
      </SettingsCard>

      <SettingsCard className="overflow-hidden">
        <RuntimeFilePreview
          buildDownloadUrl={buildDownloadUrl}
          file={selectedFile}
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
