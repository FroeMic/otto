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
import { SkillLibraryList } from "../components/SkillLibraryList"
import { SkillsList } from "../components/SkillsList"
import { SkillsNavigation } from "../components/SkillsNavigation"

export interface SkillsPageProps {
  currentSection: "installed" | "library"
  orgSlug: string
}

export function SkillsPage({ currentSection, orgSlug }: SkillsPageProps) {
  const { data } = useSuspenseQuery(workspaceSkillsQueryOptions(orgSlug))
  const hasInstalledSkills = data.installedSkills.length > 0
  const hasLibrarySkills = data.librarySkills.length > 0

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-4xl flex-col gap-8 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <SettingsPageTitle>Skills</SettingsPageTitle>
            <p className="text-sm text-muted-foreground">
              Manage the skills available to the agent in this workspace.
            </p>
          </div>
          {data.state === "ready" && currentSection === "installed" ? (
            <CreateSkillDialog
              knownIntegrationKeys={data.knownIntegrationKeys}
              orgSlug={orgSlug}
              skills={data.installedSkills}
            />
          ) : null}
        </div>

        <SkillsNavigation currentSection={currentSection} orgSlug={orgSlug} />

        {data.state === "pending_setup" ? (
          <Alert>
            <AlertTitle>Runtime not ready yet</AlertTitle>
            <AlertDescription>
              Installed skills will appear here once the runtime is ready for
              this workspace.
            </AlertDescription>
          </Alert>
        ) : currentSection === "library" ? (
          <SettingsSection>
            <SettingsSectionTitle>Skill library</SettingsSectionTitle>
            <SettingsSectionDescription>
              Review reusable skills that can be made available in this
              workspace.
            </SettingsSectionDescription>
            {hasLibrarySkills ? (
              <SkillLibraryList orgSlug={orgSlug} skills={data.librarySkills} />
            ) : (
              <Alert>
                <AlertTitle>No library skills yet</AlertTitle>
                <AlertDescription>
                  Reusable skill templates will appear here once they are added
                  to the library.
                </AlertDescription>
              </Alert>
            )}
          </SettingsSection>
        ) : hasInstalledSkills ? (
          <SettingsSection>
            <SettingsSectionTitle>Installed skills</SettingsSectionTitle>
            <SettingsSectionDescription>
              Review the skills currently available to the agent in this
              workspace.
            </SettingsSectionDescription>
            <SkillsList orgSlug={orgSlug} skills={data.installedSkills} />
          </SettingsSection>
        ) : (
          <Alert>
            <AlertTitle>No installed skills yet</AlertTitle>
            <AlertDescription>
              Create a custom skill here, or browse the library for reusable
              skills that fit this workspace.
            </AlertDescription>
          </Alert>
        )}
      </SettingsPageContent>
    </SettingsPage>
  )
}
