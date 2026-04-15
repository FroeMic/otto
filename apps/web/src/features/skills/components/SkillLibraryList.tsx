import { Badge } from "@/components/ui/badge"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"

import type { WorkspaceSkillLibraryEntry } from "../types"

export interface SkillLibraryListProps {
  skills: WorkspaceSkillLibraryEntry[]
}

export function SkillLibraryList({ skills }: SkillLibraryListProps) {
  return (
    <SettingsCard>
      {skills.map((skill) => (
        <SettingsRow key={skill.skillKey}>
          <SettingsRowLabel>
            <div className="flex flex-wrap items-center gap-2">
              <SettingsRowTitle>{skill.displayName}</SettingsRowTitle>
              <Badge variant={skill.installed ? "default" : "outline"}>
                {skill.installed ? "Installed" : "Available"}
              </Badge>
            </div>
            <SettingsRowDescription>{skill.description}</SettingsRowDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              {skill.dependencies.integrations.map((integrationKey) => (
                <Badge key={`integration-${skill.skillKey}-${integrationKey}`} variant="secondary">
                  Needs {integrationKey}
                </Badge>
              ))}
              {skill.dependencies.skills.map((dependencySkillKey) => (
                <Badge key={`skill-${skill.skillKey}-${dependencySkillKey}`} variant="secondary">
                  Needs {dependencySkillKey}
                </Badge>
              ))}
            </div>
          </SettingsRowLabel>
        </SettingsRow>
      ))}
    </SettingsCard>
  )
}
