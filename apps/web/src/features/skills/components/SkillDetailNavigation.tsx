import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { WorkspaceSkillSection } from "../types"

export interface SkillDetailNavigationProps {
  currentSection: WorkspaceSkillSection
  onSectionChange: (nextSection: WorkspaceSkillSection) => void
}

export function SkillDetailNavigation({
  currentSection,
  onSectionChange,
}: SkillDetailNavigationProps) {
  return (
    <Tabs
      onValueChange={(nextValue) => onSectionChange(nextValue as WorkspaceSkillSection)}
      value={currentSection}
    >
      <TabsList className="h-auto justify-start overflow-x-auto p-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="instructions">Instructions</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
