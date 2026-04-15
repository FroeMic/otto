import { CaretRightIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Link } from "@tanstack/react-router"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"

import { formatSkillOriginLabel, formatSkillStatusLabel, skillStatusBadgeVariant } from "../skill-presentation"
import type { WorkspaceInstalledSkillListEntry } from "../types"

export interface SkillsListProps {
  orgSlug: string
  skills: WorkspaceInstalledSkillListEntry[]
}

export function SkillsList({ orgSlug, skills }: SkillsListProps) {
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
          to="/$orgSlug/skills/$skillKey/overview"
        >
          <SettingsRow>
            <SettingsRowLabel>
              <div className="flex flex-wrap items-center gap-2">
                <SettingsRowTitle>{skill.displayName}</SettingsRowTitle>
                <Badge variant={skillStatusBadgeVariant[skill.status]}>
                  {formatSkillStatusLabel(skill.status)}
                </Badge>
                <Badge variant="secondary">
                  {formatSkillOriginLabel(skill.origin)}
                </Badge>
              </div>
              <SettingsRowDescription>{skill.description}</SettingsRowDescription>
            </SettingsRowLabel>
            <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </SettingsRow>
        </Link>
      ))}
    </SettingsCard>
  )
}
