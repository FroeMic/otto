import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"

import { installWorkspaceLibrarySkill, workspaceSkillsQueryOptions } from "../api/skills"
import type { WorkspaceSkillLibraryEntry } from "../types"

export interface SkillLibraryListProps {
  orgSlug: string
  skills: WorkspaceSkillLibraryEntry[]
}

export function SkillLibraryList({ orgSlug, skills }: SkillLibraryListProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <SettingsCard>
      {skills.map((skill) => (
        <SettingsRow key={skill.skillKey}>
          <SettingsRowLabel>
            <div className="flex flex-wrap items-center gap-2">
              <SettingsRowTitle>
                <Link
                  className="hover:underline"
                  params={{
                    orgSlug,
                    skillKey: skill.skillKey,
                  }}
                  preload="intent"
                  to="/$orgSlug/skills/library/$skillKey"
                >
                  {skill.displayName}
                </Link>
              </SettingsRowTitle>
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
          {skill.installed ? (
            <Button
              onClick={() => {
                void navigate({
                  params: {
                    orgSlug,
                    skillKey: skill.skillKey,
                  },
                  to: "/$orgSlug/skills/$skillKey/overview",
                })
              }}
              type="button"
              variant="outline"
            >
              Open
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link
                params={{
                  orgSlug,
                  skillKey: skill.skillKey,
                }}
                preload="intent"
                to="/$orgSlug/skills/library/$skillKey"
              >
                <Button type="button" variant="outline">
                  View
                </Button>
              </Link>
              <Button
                disabled={!skill.installable}
                onClick={() => {
                  void installWorkspaceLibrarySkill({
                    orgSlug,
                    skillKey: skill.skillKey,
                  })
                    .then(async (result) => {
                      await queryClient.invalidateQueries({
                        queryKey: workspaceSkillsQueryOptions(orgSlug).queryKey,
                      })

                      void navigate({
                        params: {
                          orgSlug,
                          skillKey: result.skillKey,
                        },
                        to: "/$orgSlug/skills/$skillKey/overview",
                      })
                    })
                    .catch((error) => {
                      toast.error("Skill could not be installed", {
                        description:
                          error instanceof Error ? error.message : "Unknown error",
                      })
                    })
                }}
                type="button"
              >
                Install
              </Button>
            </div>
          )}
        </SettingsRow>
      ))}
    </SettingsCard>
  )
}
