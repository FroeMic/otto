"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.default),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    ),
    ssr: false,
  },
);

export type RuntimeDirectoryFileSnapshot = {
  contentText: string | null;
  contentType: string | null;
  path: string;
  sizeBytes: number;
  storageEncoding: "binary" | "utf8_text";
  truncated: boolean;
};

export type RuntimeDirectorySnapshot = {
  files: RuntimeDirectoryFileSnapshot[];
  rootExists: boolean;
  rootPath: string;
};

type ExplorerTreeNode =
  | {
      children: ExplorerTreeNode[];
      kind: "directory";
      name: string;
      path: string;
    }
  | {
      file: RuntimeDirectoryFileSnapshot;
      kind: "file";
      name: string;
      path: string;
    };

type MutableExplorerDirectoryNode = {
  directories: Map<string, MutableExplorerDirectoryNode>;
  files: RuntimeDirectoryFileSnapshot[];
  name: string;
  path: string;
};

type Props = {
  downloadPath: string;
  emptyDirectoryMessage?: string;
  explorerLabel: string;
  fetchPath: string;
  hiddenPathPrefixes?: string[];
  hiddenPaths?: string[];
  loadingMessage?: string;
  missingRootMessage: string;
  rootPathFallback: string;
};

export function RuntimeFileBrowser({
  downloadPath,
  emptyDirectoryMessage = "This directory is currently empty.",
  explorerLabel,
  fetchPath,
  hiddenPathPrefixes = [],
  hiddenPaths = [],
  loadingMessage = "Loading files…",
  missingRootMessage,
  rootPathFallback,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeDirectorySnapshot | null>(
    null,
  );
  const visibleFiles = (snapshot?.files ?? []).filter(
    (file) =>
      !hiddenPaths.includes(file.path) &&
      !hiddenPathPrefixes.some((prefix) => file.path.startsWith(prefix)),
  );
  const tree = buildExplorerTree(visibleFiles);
  const selectedFile =
    visibleFiles.find((file) => file.path === selectedFilePath) ??
    visibleFiles.find((file) => isPreviewableImage(file)) ??
    visibleFiles.find((file) => file.storageEncoding === "utf8_text") ??
    visibleFiles[0] ??
    null;

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(fetchPath, { cache: "no-store" });
        const payload = (await response.json()) as
          | {
              message?: string;
              snapshot?: RuntimeDirectorySnapshot;
            }
          | undefined;

        if (!response.ok || !payload?.snapshot) {
          throw new Error(payload?.message ?? "Failed to load files.");
        }

        if (cancelled) {
          return;
        }

        setSnapshot(payload.snapshot);
        setExpandedDirectories(
          collectExpandedDirectories(payload.snapshot.files),
        );
        setSelectedFilePath(
          payload.snapshot.files.find((file) => isPreviewableImage(file))
            ?.path ??
            payload.snapshot.files.find(
              (file) => file.storageEncoding === "utf8_text",
            )?.path ??
            payload.snapshot.files[0]?.path ??
            null,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSnapshot(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load files.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, [fetchPath]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (
      selectedFilePath &&
      visibleFiles.some((file) => file.path === selectedFilePath)
    ) {
      return;
    }

    setSelectedFilePath(
      visibleFiles.find((file) => isPreviewableImage(file))?.path ??
        visibleFiles.find((file) => file.storageEncoding === "utf8_text")
          ?.path ??
        visibleFiles[0]?.path ??
        null,
    );
  }, [selectedFilePath, visibleFiles, snapshot]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(fetchPath, { cache: "no-store" });
      const payload = (await response.json()) as
        | {
            message?: string;
            snapshot?: RuntimeDirectorySnapshot;
          }
        | undefined;

      if (!response.ok || !payload?.snapshot) {
        throw new Error(payload?.message ?? "Failed to refresh files.");
      }

      const nextSnapshot = payload.snapshot;

      setSnapshot(nextSnapshot);
      setExpandedDirectories((current) =>
        current.length > 0
          ? current
          : collectExpandedDirectories(nextSnapshot.files),
      );
      setSelectedFilePath((current) => {
        if (
          current &&
          nextSnapshot.files.some((file) => file.path === current)
        ) {
          return current;
        }

        return (
          nextSnapshot.files.find((file) => isPreviewableImage(file))?.path ??
          nextSnapshot.files.find(
            (file) => file.storageEncoding === "utf8_text",
          )?.path ??
          nextSnapshot.files[0]?.path ??
          null
        );
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to refresh files.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleDirectoryToggle(path: string) {
    setExpandedDirectories((current) =>
      current.includes(path)
        ? current.filter((entry) => entry !== path)
        : [...current, path],
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex h-[42rem] items-center justify-center text-sm text-muted-foreground">
          {loadingMessage}
        </div>
      </div>
    );
  }

  if (errorMessage && !snapshot) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>Files unavailable</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <div>
          <Button onClick={handleRefresh} type="button" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Refresh failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Files
            </div>
            <div className="truncate font-mono text-sm text-foreground">
              {snapshot?.rootPath ?? rootPathFallback}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {visibleFiles.length}{" "}
              {visibleFiles.length === 1 ? "file" : "files"}
            </Badge>
            <Button
              disabled={isRefreshing}
              onClick={handleRefresh}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw
                className={cn("size-4", isRefreshing ? "animate-spin" : "")}
              />
              Refresh
            </Button>
          </div>
        </div>

        {!snapshot?.rootExists ? (
          <div className="flex h-[38rem] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {missingRootMessage}
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className="flex h-[38rem] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {emptyDirectoryMessage}
          </div>
        ) : (
          <>
            <div className="hidden h-[42rem] min-h-0 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
              <div className="min-h-0 border-r border-border">
                <ExplorerPane
                  downloadPath={downloadPath}
                  expandedDirectories={expandedDirectories}
                  explorerLabel={explorerLabel}
                  onDirectoryToggle={handleDirectoryToggle}
                  onFileSelect={setSelectedFilePath}
                  selectedFilePath={selectedFile?.path ?? null}
                  tree={tree}
                />
              </div>
              <div className="min-h-0 overflow-hidden">
                <EditorPane
                  downloadPath={downloadPath}
                  selectedFile={selectedFile}
                  theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4 lg:hidden">
              <div className="overflow-hidden rounded-xl border border-border">
                <ExplorerPane
                  downloadPath={downloadPath}
                  expandedDirectories={expandedDirectories}
                  explorerLabel={explorerLabel}
                  onDirectoryToggle={handleDirectoryToggle}
                  onFileSelect={setSelectedFilePath}
                  selectedFilePath={selectedFile?.path ?? null}
                  tree={tree}
                />
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <EditorPane
                  downloadPath={downloadPath}
                  selectedFile={selectedFile}
                  theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExplorerPane(input: {
  downloadPath: string;
  expandedDirectories: string[];
  explorerLabel: string;
  onDirectoryToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
  selectedFilePath: string | null;
  tree: ExplorerTreeNode[];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/10">
      <div className="border-b border-border px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Explorer
        </div>
        <div className="mt-1 truncate font-medium text-foreground">
          {input.explorerLabel}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 py-2">
          {input.tree.map((node) => (
            <ExplorerNode
              expandedDirectories={input.expandedDirectories}
              key={node.path}
              node={node}
              downloadPath={input.downloadPath}
              onDirectoryToggle={input.onDirectoryToggle}
              onFileSelect={input.onFileSelect}
              selectedFilePath={input.selectedFilePath}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ExplorerNode(input: {
  downloadPath: string;
  expandedDirectories: string[];
  node: ExplorerTreeNode;
  onDirectoryToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
  selectedFilePath: string | null;
}) {
  return renderExplorerNode({
    ...input,
    depth: 0,
  });
}

function renderExplorerNode(input: {
  depth: number;
  downloadPath: string;
  expandedDirectories: string[];
  node: ExplorerTreeNode;
  onDirectoryToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
  selectedFilePath: string | null;
}): JSX.Element {
  if (input.node.kind === "directory") {
    const isExpanded = input.expandedDirectories.includes(input.node.path);
    const downloadHref = buildDownloadHref({
      downloadPath: input.downloadPath,
      kind: "directory",
      path: input.node.path,
    });

    return (
      <div key={input.node.path}>
        <div
          className="group flex items-center gap-2 rounded-lg pr-1 transition-colors hover:bg-muted/60"
          style={{ paddingLeft: `${input.depth * 16 + 8}px` }}
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
            onClick={() => input.onDirectoryToggle(input.node.path)}
            type="button"
          >
            {isExpanded ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Folder className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{input.node.name}</span>
          </button>
          <a
            aria-label={`Download ${input.node.name} as zip`}
            className={cn(
              buttonVariants({ size: "icon", variant: "ghost" }),
              "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            )}
            href={downloadHref}
            onClick={(event) => event.stopPropagation()}
          >
            <Download className="size-4" />
          </a>
        </div>

        {isExpanded
          ? input.node.children.map((child) =>
              renderExplorerNode({
                ...input,
                depth: input.depth + 1,
                node: child,
              }),
            )
          : null}
      </div>
    );
  }

  const isSelected = input.selectedFilePath === input.node.path;
  const downloadHref = buildDownloadHref({
    downloadPath: input.downloadPath,
    kind: "file",
    path: input.node.path,
  });

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg pr-1 transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
      key={input.node.path}
      style={{ paddingLeft: `${input.depth * 16 + 28}px` }}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
        onClick={() => input.onFileSelect(input.node.path)}
        type="button"
      >
        <File className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{input.node.name}</span>
      </button>
      <a
        aria-label={`Download ${input.node.name}`}
        className={cn(
          buttonVariants({ size: "icon", variant: "ghost" }),
          "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
        )}
        href={downloadHref}
        onClick={(event) => event.stopPropagation()}
      >
        <Download className="size-4" />
      </a>
    </div>
  );
}

function EditorPane(input: {
  downloadPath: string;
  selectedFile: RuntimeDirectoryFileSnapshot | null;
  theme: "vs" | "vs-dark";
}) {
  if (!input.selectedFile) {
    return (
      <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-muted-foreground">
        Select a file to inspect it.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[24rem] flex-col overflow-hidden">
      <div className="sr-only">
        Selected file preview for {input.selectedFile.path}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="truncate font-mono text-sm text-foreground">
            {input.selectedFile.path}
          </div>
          <div className="text-xs text-muted-foreground">
            {input.selectedFile.contentType ??
              (input.selectedFile.storageEncoding === "utf8_text"
                ? "text/plain"
                : "application/octet-stream")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Read only</Badge>
          <Badge variant="outline">
            {input.selectedFile.storageEncoding === "utf8_text"
              ? "UTF-8"
              : "Binary"}
          </Badge>
          <Badge variant="outline">
            {formatFileSize(input.selectedFile.sizeBytes)}
          </Badge>
          <a
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={buildDownloadHref({
              downloadPath: input.downloadPath,
              kind: "file",
              path: input.selectedFile.path,
            })}
          >
            <Download className="size-4" />
            Download
          </a>
        </div>
      </div>

      {input.selectedFile.truncated &&
      input.selectedFile.storageEncoding === "utf8_text" &&
      !isPreviewableImage(input.selectedFile) ? (
        <div className="border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-muted-foreground">
          Preview truncated to the first 256 KB.
        </div>
      ) : null}

      {isPreviewableImage(input.selectedFile) ? (
        <div className="flex h-full min-h-[24rem] items-center justify-center overflow-auto bg-muted/10 p-6">
          <Image
            alt={input.selectedFile.path}
            className="max-h-full max-w-full rounded-lg border border-border bg-background object-contain shadow-sm"
            src={buildDownloadHref({
              disposition: "inline",
              downloadPath: input.downloadPath,
              kind: "file",
              path: input.selectedFile.path,
            })}
            height={1400}
            unoptimized
            width={1400}
          />
        </div>
      ) : input.selectedFile.storageEncoding === "utf8_text" &&
        input.selectedFile.contentText !== null ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <MonacoEditor
            height="100%"
            language={getMonacoLanguage(input.selectedFile.path)}
            options={{
              fixedOverflowWidgets: true,
              fontSize: 13,
              minimap: { enabled: false },
              readOnly: true,
              renderLineHighlight: "all",
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: shouldWrapContent(input.selectedFile.path)
                ? "on"
                : "off",
            }}
            path={input.selectedFile.path}
            theme={input.theme}
            value={input.selectedFile.contentText}
          />
        </div>
      ) : (
        <div className="flex h-full min-h-[24rem] items-center justify-center px-6 text-center text-sm text-muted-foreground">
          This file cannot be previewed in the workspace yet. Download it to
          inspect it locally.
        </div>
      )}
    </div>
  );
}

function buildDownloadHref(input: {
  disposition?: "attachment" | "inline";
  downloadPath: string;
  kind: "directory" | "file";
  path: string;
}) {
  const params = new URLSearchParams({
    kind: input.kind,
    path: input.path,
  });

  if (input.disposition === "inline") {
    params.set("disposition", "inline");
  }

  return `${input.downloadPath}?${params.toString()}`;
}

function isPreviewableImage(file: RuntimeDirectoryFileSnapshot) {
  if (file.contentType?.startsWith("image/")) {
    return true;
  }

  const extension = file.path.split(".").pop()?.toLowerCase();
  return ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"].includes(
    extension ?? "",
  );
}

function buildExplorerTree(files: RuntimeDirectoryFileSnapshot[]) {
  const root: MutableExplorerDirectoryNode = {
    directories: new Map<string, MutableExplorerDirectoryNode>(),
    files: [],
    name: "",
    path: "",
  };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    for (const [index, part] of parts.entries()) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;

      if (isLeaf) {
        current.files.push(file);
        continue;
      }

      const existing = current.directories.get(currentPath);

      if (existing) {
        current = existing;
        continue;
      }

      const nextDirectory = {
        directories: new Map<string, MutableExplorerDirectoryNode>(),
        files: [],
        name: part,
        path: currentPath,
      };

      current.directories.set(currentPath, nextDirectory);
      current = nextDirectory;
    }
  }

  return convertDirectoryToTree(root);
}

function collectExpandedDirectories(files: RuntimeDirectoryFileSnapshot[]) {
  const directories = new Set<string>();

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let currentPath = "";

    for (const part of parts.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      directories.add(currentPath);
    }
  }

  return [...directories].sort((left, right) => left.localeCompare(right));
}

function convertDirectoryToTree(
  directory: MutableExplorerDirectoryNode,
): ExplorerTreeNode[] {
  const directories = [...directory.directories.values()]
    .map((childDirectory) => ({
      children: convertDirectoryToTree(childDirectory),
      kind: "directory" as const,
      name: childDirectory.name,
      path: childDirectory.path,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const files = [...directory.files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => ({
      file,
      kind: "file" as const,
      name: file.path.split("/").pop() ?? file.path,
      path: file.path,
    }));

  return [...directories, ...files];
}

function getMonacoLanguage(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "md":
      return "markdown";
    case "json":
      return "json";
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "yaml":
    case "yml":
      return "yaml";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sql":
      return "sql";
    case "xml":
      return "xml";
    case "py":
      return "python";
    default:
      return "plaintext";
  }
}

function shouldWrapContent(path: string) {
  const language = getMonacoLanguage(path);
  return language === "markdown" || language === "plaintext";
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
