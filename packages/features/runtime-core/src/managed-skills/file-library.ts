import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs"
import path from "node:path"
import { z } from "zod"

import type { SystemManagedSkillDefinition } from "./system-skills"

const skillMetadataSchema = z.object({
  installMode: z.enum(["default_installed", "manual_install"]),
  skillKey: z.string().trim().min(1),
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
}

function loadSystemManagedSkillDefinition(
  skillRoot: string,
): SystemManagedSkillDefinition {
  const metadata = skillMetadataSchema.parse(
    JSON.parse(readFileSync(path.join(skillRoot, "skill.json"), "utf8")),
  )
  const files = listSkillPackageFiles(skillRoot).map((relativePath) => ({
    contentText: readFileSync(path.join(skillRoot, relativePath), "utf8"),
    path: relativePath,
  }))

  return {
    ...metadata,
    files,
  }
}

function listSkillPackageFiles(skillRoot: string) {
  const filePaths: string[] = []

  visitDirectory(skillRoot, "", filePaths)

  return filePaths
    .filter(isManagedSkillPackageSourceFile)
    .sort(compareSkillPackageFilePaths)
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

function compareSkillPackageFilePaths(left: string, right: string) {
  if (left === "SKILL.md") {
    return -1
  }

  if (right === "SKILL.md") {
    return 1
  }

  return left.localeCompare(right)
}
