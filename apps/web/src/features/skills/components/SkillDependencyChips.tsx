import { Badge } from "@/components/ui/badge"

import {
  formatDependencyIntegrationLabel,
  formatDependencySkillLabel,
} from "../skill-presentation"

export interface SkillDependencyChipsProps {
  integrations: string[]
  skills: string[]
}

export function SkillDependencyChips({
  integrations,
  skills,
}: SkillDependencyChipsProps) {
  if (integrations.length === 0 && skills.length === 0) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Dependencies:</span>
      {integrations.map((integrationKey) => (
        <Badge key={`integration-${integrationKey}`} variant="secondary">
          {formatDependencyIntegrationLabel(integrationKey)}
        </Badge>
      ))}
      {skills.map((skillKey) => (
        <Badge key={`skill-${skillKey}`} variant="secondary">
          {formatDependencySkillLabel(skillKey)}
        </Badge>
      ))}
    </div>
  )
}
