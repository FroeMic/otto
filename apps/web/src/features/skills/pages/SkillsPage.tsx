import { useSuspenseQuery } from "@tanstack/react-query"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { workspaceSkillsQueryOptions } from "../api/skills"
import { CreateSkillDialog } from "../components/CreateSkillDialog"
import { SkillsList } from "../components/SkillsList"

export interface SkillsPageProps {
  orgSlug: string
}

export function SkillsPage({ orgSlug }: SkillsPageProps) {
  const { data } = useSuspenseQuery(workspaceSkillsQueryOptions(orgSlug))

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-4xl flex-col gap-8 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <SettingsPageTitle>Skills</SettingsPageTitle>
            <p className="text-sm text-muted-foreground">
              Review and edit the reusable skill packages Otto keeps for this
              workspace.
            </p>
          </div>
          {data.state === "ready" ? (
            <CreateSkillDialog
              knownIntegrationKeys={data.knownIntegrationKeys}
              orgSlug={orgSlug}
              skills={data.skills}
            />
          ) : null}
        </div>

        {data.state === "pending_setup" ? (
          <Alert>
            <AlertTitle>No Otto runtime yet</AlertTitle>
            <AlertDescription>
              Skills will appear here once Otto has been provisioned for this
              workspace.
            </AlertDescription>
          </Alert>
        ) : data.skills.length === 0 ? (
          <Alert>
            <AlertTitle>No skills yet</AlertTitle>
            <AlertDescription>
              Create the first `SKILL.md` package here, then open it to inspect
              its runtime files and edit its instructions.
            </AlertDescription>
          </Alert>
        ) : (
          <SettingsSection>
            <SettingsSectionTitle>Managed skills</SettingsSectionTitle>
            <SettingsSectionDescription>
              Open a skill package to inspect its files, check prerequisites,
              and edit `SKILL.md` where the package is workspace-managed.
            </SettingsSectionDescription>
            <SkillsList orgSlug={orgSlug} skills={data.skills} />
          </SettingsSection>
        )}
      </SettingsPageContent>
    </SettingsPage>
  )
}
