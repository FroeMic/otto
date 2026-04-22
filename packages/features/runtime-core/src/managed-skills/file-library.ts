import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { z } from "zod"

import type { SystemManagedSkillDefinition } from "./system-skills"

const skillMetadataSchema = z.object({
  fileOrder: z.array(z.string().trim().min(1)).optional(),
  installMode: z.enum(["default_installed", "manual_install"]),
  skillKey: z.string().trim().min(1),
  sortOrder: z.number().optional(),
  summary: z.string().trim().min(1),
  visibleInLibrary: z.boolean(),
})

const managedSkillSourceFileNames = new Set(["SKILL.md", "skill.json"])
const managedSkillCompanionDirectoryPrefixes = [
  "examples/",
  "references/",
  "scripts/",
  "templates/",
] as const

export function loadSystemManagedSkillDefinitionsFromDirectory(
  libraryRoot: string,
): SystemManagedSkillDefinition[] {
  return readdirSync(libraryRoot)
    .filter((entryName) => {
      const entryPath = path.join(libraryRoot, entryName)
      return statSync(entryPath).isDirectory()
    })
    .sort((left, right) => left.localeCompare(right))
    .map((entryName) =>
      loadSystemManagedSkillDefinition(path.join(libraryRoot, entryName)),
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.definition.skillKey.localeCompare(right.definition.skillKey),
    )
    .map((loadedDefinition) => loadedDefinition.definition)
}

function loadSystemManagedSkillDefinition(skillRoot: string): {
  definition: SystemManagedSkillDefinition
  sortOrder: number
} {
  const metadata = skillMetadataSchema.parse(
    JSON.parse(readFileSync(path.join(skillRoot, "skill.json"), "utf8")),
  )
  const files = listSkillPackageFiles(skillRoot, metadata.fileOrder).map(
    (relativePath) => ({
      contentText: readFileSync(path.join(skillRoot, relativePath), "utf8"),
      path: relativePath,
    }),
  )

  return {
    definition: {
      files,
      installMode: metadata.installMode,
      skillKey: metadata.skillKey,
      summary: metadata.summary,
      visibleInLibrary: metadata.visibleInLibrary,
    },
    sortOrder: metadata.sortOrder ?? Number.MAX_SAFE_INTEGER,
  }
}

function listSkillPackageFiles(skillRoot: string, fileOrder: string[] = []) {
  const filePaths: string[] = []

  visitDirectory(skillRoot, "", filePaths)

  return filePaths
    .filter(isManagedSkillPackageSourceFile)
    .sort((left, right) => compareSkillPackageFilePaths(left, right, fileOrder))
}

function visitDirectory(
  absoluteDirectory: string,
  relativeDirectory: string,
  filePaths: string[],
) {
  for (const entryName of readdirSync(absoluteDirectory).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const absolutePath = path.join(absoluteDirectory, entryName)
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entryName}`
      : entryName

    if (statSync(absolutePath).isDirectory()) {
      visitDirectory(absolutePath, relativePath, filePaths)
      continue
    }

    filePaths.push(relativePath)
  }
}

function isManagedSkillPackageSourceFile(relativePath: string) {
  if (managedSkillSourceFileNames.has(relativePath)) {
    return relativePath !== "skill.json"
  }

  return managedSkillCompanionDirectoryPrefixes.some((prefix) =>
    relativePath.startsWith(prefix),
  )
}

function compareSkillPackageFilePaths(
  left: string,
  right: string,
  fileOrder: string[],
) {
  const leftOrder = fileOrder.indexOf(left)
  const rightOrder = fileOrder.indexOf(right)

  if (leftOrder !== -1 || rightOrder !== -1) {
    return (
      (leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder) -
      (rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder)
    )
  }

  if (left === "SKILL.md") {
    return -1
  }

  if (right === "SKILL.md") {
    return 1
  }

  return left.localeCompare(right)
}
