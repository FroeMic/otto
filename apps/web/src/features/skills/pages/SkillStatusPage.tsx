import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsPageContent,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { workspaceSkillDetailQueryOptions } from "../api/skills"
import { SkillDetailNavigation } from "../components/SkillDetailNavigation"
import { SkillEditorCard } from "../components/SkillEditorCard"

export interface SkillStatusPageProps {
  orgSlug: string
  skillKey: string
}

export function SkillStatusPage({ orgSlug, skillKey }: SkillStatusPageProps) {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(
    workspaceSkillDetailQueryOptions({
      orgSlug,
      skillKey,
    }),
  )

  if (data.state === "pending_setup" || !data.detail) {
    return (
      <SettingsPage>
        <SettingsPageContent className="flex max-w-4xl flex-col gap-6 pb-8">
          <Alert>
            <AlertTitle>Runtime not ready</AlertTitle>
            <AlertDescription>
              This workspace does not have a ready Otto runtime yet, so the
              skill package cannot be inspected here.
            </AlertDescription>
          </Alert>
        </SettingsPageContent>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-4xl flex-col gap-6 pb-8">
        <SkillDetailNavigation
          currentSection="status"
          onSectionChange={(nextSection) => {
            void navigate({
              params: {
                orgSlug,
                skillKey,
              },
              to:
                nextSection === "files"
                  ? "/$orgSlug/skills/$skillKey/files"
                  : "/$orgSlug/skills/$skillKey/status",
            })
          }}
        />
        <SkillEditorCard
          detail={data.detail}
          knownIntegrationKeys={data.knownIntegrationKeys}
          knownSkillKeys={data.knownSkillKeys}
          orgSlug={orgSlug}
        />
      </SettingsPageContent>
    </SettingsPage>
  )
}
