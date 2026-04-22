import { CaretRightIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Badge } from "@/components/ui/badge"

import type { WorkspaceSkillLibraryEntry } from "../types"
import { SkillDependencyChips } from "./SkillDependencyChips"

export interface SkillLibraryListProps {
  orgSlug: string
  skills: WorkspaceSkillLibraryEntry[]
}

export function SkillLibraryList({ orgSlug, skills }: SkillLibraryListProps) {
  return (
    <SettingsCard>
      {skills.map((skill) => (
        <Link
          key={skill.skillKey}
          className="block transition-colors hover:bg-muted/30"
          params={{
            orgSlug,
            skillKey: skill.skillKey,
          }}
          preload="intent"
          to={
            skill.installed
              ? "/$orgSlug/skills/$skillKey/overview"
              : "/$orgSlug/skills/library/$skillKey"
          }
        >
          <SettingsRow>
            <SettingsRowLabel>
              <div className="flex flex-wrap items-center gap-2">
                <SettingsRowTitle>{skill.displayName}</SettingsRowTitle>
                <Badge variant={skill.installed ? "secondary" : "outline"}>
                  {skill.installed ? "Installed" : "Available"}
                </Badge>
              </div>
              <SettingsRowDescription>
                {skill.description}
              </SettingsRowDescription>
              <div className="mt-2">
                <SkillDependencyChips
                  integrations={skill.dependencies.integrations}
                  skills={skill.dependencies.skills}
                />
              </div>
            </SettingsRowLabel>
            <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </SettingsRow>
        </Link>
      ))}
    </SettingsCard>
  )
}
