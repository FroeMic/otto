import type {
  RuntimeDirectoryFileSnapshot,
  RuntimeDirectorySnapshot,
} from "@otto/feature-runtime-core/runtime-files/types"
import { ArrowsClockwiseIcon } from "@phosphor-icons/react"
import { useDeferredValue, useEffect, useMemo, useState } from "react"

import {
  SettingsCard,
  SettingsRow,
} from "@/client/app/app-shell/SettingsLayout"
import { ToolbarSearchInput } from "@/components/toolbar-search-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { RuntimeFileSelection } from "../types"
import { RuntimeFilePreview } from "./RuntimeFilePreview"
import { RuntimeFileTree } from "./RuntimeFileTree"
import {
  buildExplorerTree,
  collectExpandedDirectories,
  collectVisibleDirectoryPaths,
  filterRuntimeFilesForSearch,
  getInitialExpandedDirectories,
} from "./runtime-file-browser-model"

export interface RuntimeFileBrowserProps {
  buildDownloadUrl: (input: {
    disposition?: "attachment" | "inline"
    kind?: "directory" | "file"
    path: string
  }) => string
  emptyDirectoryMessage?: string
  explorerLabel: string
  pathDisplayNames?: Record<string, string>
  hiddenPathPrefixes?: string[]
  hiddenPaths?: string[]
  isRefreshing?: boolean
  missingRootMessage: string
  onRefresh: () => undefined | Promise<unknown>
  preferredFilePath?: string
  rootPathFallback: string
  snapshot: RuntimeDirectorySnapshot
}

const EMPTY_HIDDEN_PATHS: string[] = []
const EMPTY_PATH_DISPLAY_NAMES: Record<string, string> = {}

export function RuntimeFileBrowser({
  buildDownloadUrl,
  emptyDirectoryMessage = "This directory is currently empty.",
  explorerLabel,
  pathDisplayNames = EMPTY_PATH_DISPLAY_NAMES,
  hiddenPathPrefixes = EMPTY_HIDDEN_PATHS,
  hiddenPaths = EMPTY_HIDDEN_PATHS,
  isRefreshing = false,
  missingRootMessage,
  onRefresh,
  preferredFilePath,
  rootPathFallback,
  snapshot,
}: RuntimeFileBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>(() =>
    getInitialExpandedDirectories(),
  )
  const [selectedNode, setSelectedNode] = useState<RuntimeFileSelection | null>(
    null,
  )
  const unfilteredVisibleFiles = useMemo(
    () =>
      snapshot.files.filter(
        (file) =>
          !hiddenPaths.includes(file.path) &&
          !hiddenPathPrefixes.some((prefix) => file.path.startsWith(prefix)),
      ),
    [hiddenPathPrefixes, hiddenPaths, snapshot.files],
  )
  const visibleFiles = useMemo(
    () =>
      filterRuntimeFilesForSearch(unfilteredVisibleFiles, deferredSearchQuery),
    [deferredSearchQuery, unfilteredVisibleFiles],
  )
  const isSearching = deferredSearchQuery.trim().length > 0
  const tree = useMemo(
    () => buildExplorerTree(visibleFiles, pathDisplayNames),
    [pathDisplayNames, visibleFiles],
  )
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
    const nextVisibleDirectoryPaths = collectVisibleDirectoryPaths(visibleFiles)

    setExpandedDirectories(
      isSearching ? collectExpandedDirectories(visibleFiles) : [],
    )
    setSelectedNode((current) => {
      if (
        current?.kind === "file" &&
        visibleFiles.some((file) => file.path === current.path)
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
        visibleFiles.find((file) => file.path === preferredFilePath) ??
        visibleFiles.find((file) => isPreviewableImage(file)) ??
        visibleFiles.find((file) => file.storageEncoding === "utf8_text") ??
        visibleFiles[0] ??
        null

      if (!defaultFile) {
        return null
      }

      return {
        kind: "file",
        path: defaultFile.path,
      }
    })
  }, [isSearching, preferredFilePath, visibleFiles])

  if (!snapshot.rootExists) {
    return (
      <Alert>
        <AlertTitle>Workspace directory not found</AlertTitle>
        <AlertDescription>
          {missingRootMessage} Expected root:{" "}
          {snapshot.rootPath || rootPathFallback}
        </AlertDescription>
      </Alert>
    )
  }

  if (unfilteredVisibleFiles.length === 0) {
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
          <ToolbarSearchInput
            aria-label={`Search ${explorerLabel.toLowerCase()}`}
            autoComplete="off"
            containerClassName="max-w-none flex-1"
            name="runtime-file-search"
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search files and folders…"
            type="search"
            value={searchQuery}
          />
          <Button
            aria-label="Refresh files"
            className="size-9 shrink-0"
            onClick={() => {
              void onRefresh()
            }}
            size="icon"
            title="Refresh files"
            type="button"
            variant="outline"
          >
            <ArrowsClockwiseIcon
              aria-hidden="true"
              className={isRefreshing ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </SettingsRow>
        {visibleFiles.length > 0 ? (
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
        ) : (
          <div className="flex h-[36rem] items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
            No files or folders match this search.
          </div>
        )}
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
