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

import type { WorkspaceSkillListEntry } from "../types"

export interface SkillsListProps {
  orgSlug: string
  skills: WorkspaceSkillListEntry[]
}

const statusBadgeVariant: Record<
  WorkspaceSkillListEntry["status"],
  "default" | "destructive" | "outline" | "secondary"
> = {
  disabled: "secondary",
  invalid: "destructive",
  missing_prerequisite: "outline",
  projection_failed: "destructive",
  ready: "default",
}

function formatStatusLabel(status: WorkspaceSkillListEntry["status"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatSourceLabel(sourceType: WorkspaceSkillListEntry["sourceType"]) {
  return sourceType === "integration_contribution"
    ? "Integration starter"
    : sourceType === "system"
      ? "System managed"
      : "Workspace managed"
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
          to="/$orgSlug/skills/$skillKey/status"
        >
          <SettingsRow>
            <SettingsRowLabel>
              <div className="flex flex-wrap items-center gap-2">
                <SettingsRowTitle>{skill.displayName}</SettingsRowTitle>
                <Badge variant={statusBadgeVariant[skill.status]}>
                  {formatStatusLabel(skill.status)}
                </Badge>
                <Badge variant="secondary">
                  {formatSourceLabel(skill.sourceType)}
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
