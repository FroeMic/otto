import type { RuntimeDirectoryFileSnapshot } from "@otto/feature-runtime-core/runtime-files/types"

import type { WorkspaceSkillDetail } from "./types"

export function summarizeSkillFileProvenance(input: {
  managedFiles: WorkspaceSkillDetail["files"]
  runtimeFiles: RuntimeDirectoryFileSnapshot[]
}) {
  const managedByPath = new Map(
    input.managedFiles.map((file) => [file.path, file] as const),
  )
  const runtimeByPath = new Map(
    input.runtimeFiles.map((file) => [file.path, file] as const),
  )

  const instructionsFile =
    input.managedFiles.find((file) => file.fileClass === "managed_entry") ??
    null

  const templateFiles = input.managedFiles
    .filter((file) => file.fileClass === "managed_seeded")
    .sort((left, right) => left.path.localeCompare(right.path))

  const runtimeOnlyFiles = input.runtimeFiles
    .filter((file) => !managedByPath.has(file.path))
    .sort((left, right) => left.path.localeCompare(right.path))

  const missingFromRuntime = input.managedFiles
    .filter((file) => !runtimeByPath.has(file.path))
    .sort((left, right) => left.path.localeCompare(right.path))

  return {
    instructionsFile,
    missingFromRuntime,
    runtimeOnlyFiles,
    templateFiles,
  }
}
