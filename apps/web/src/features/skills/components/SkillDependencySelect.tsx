import { useMemo } from "react"

import {
  buildSkillDependencyOptions,
  type DependencySelectOption,
} from "../dependency-select-options"
import type { WorkspaceInstalledSkillListEntry } from "../types"
import { DependencyMultiSelect } from "./DependencyMultiSelect"

export interface SkillDependencySelectProps {
  disabled?: boolean
  knownSkillKeys: string[]
  selectedSkillKeys: string[]
  skills: WorkspaceInstalledSkillListEntry[]
  onSelectedSkillKeysChange: (selectedSkillKeys: string[]) => void
}

export function SkillDependencySelect({
  disabled = false,
  knownSkillKeys,
  onSelectedSkillKeysChange,
  selectedSkillKeys,
  skills,
}: SkillDependencySelectProps) {
  const options = useMemo<DependencySelectOption[]>(
    () =>
      buildSkillDependencyOptions({
        knownSkillKeys,
        skills,
      }),
    [knownSkillKeys, skills],
  )

  return (
    <DependencyMultiSelect
      disabled={disabled}
      emptyMessage="No skills found."
      options={options}
      placeholder="Select skills"
      searchPlaceholder="Search skills..."
      selectedValues={selectedSkillKeys}
      onSelectedValuesChange={onSelectedSkillKeysChange}
    />
  )
}
