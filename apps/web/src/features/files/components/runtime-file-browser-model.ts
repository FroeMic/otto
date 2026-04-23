import type { RuntimeDirectoryFileSnapshot } from "@otto/feature-runtime-core/runtime-files/types"

import type { RuntimeFileTreeNode } from "../types"

export function filterRuntimeFilesForSearch(
  files: RuntimeDirectoryFileSnapshot[],
  query: string,
) {
  const normalizedQuery = normalizeSearchValue(query)

  if (!normalizedQuery) {
    return files
  }

  return files.filter((file) => {
    const normalizedPath = normalizeSearchValue(file.path)
    const segments = normalizedPath.split("/").filter(Boolean)
    const folderSegments = segments.slice(0, -1)

    return (
      normalizedPath.includes(normalizedQuery) ||
      folderSegments.some((segment) => segment.includes(normalizedQuery))
    )
  })
}

export function buildExplorerTree(
  files: RuntimeDirectoryFileSnapshot[],
  pathDisplayNames: Record<string, string>,
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

  return convertMutableDirectoryNode(root, pathDisplayNames)
}

export function getInitialExpandedDirectories() {
  return [] as string[]
}

export function collectExpandedDirectories(
  files: RuntimeDirectoryFileSnapshot[],
) {
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

export function collectVisibleDirectoryPaths(
  files: RuntimeDirectoryFileSnapshot[],
) {
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

function convertMutableDirectoryNode(
  node: MutableDirectoryNode,
  pathDisplayNames: Record<string, string>,
): RuntimeFileTreeNode[] {
  const childDirectories = Array.from(node.directories.values())
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((directory) => ({
      children: convertMutableDirectoryNode(directory, pathDisplayNames),
      kind: "directory" as const,
      name: pathDisplayNames[directory.path] ?? directory.name,
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

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}
