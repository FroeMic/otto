import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useTransition } from "react"
import { toast } from "sonner"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
  installWorkspaceLibrarySkill,
  workspaceSkillLibraryDetailQueryOptions,
  workspaceSkillsQueryOptions,
} from "../api/skills"
import { SkillsNavigation } from "../components/SkillsNavigation"

export interface SkillLibraryDetailPageProps {
  orgSlug: string
  skillKey: string
}

export function SkillLibraryDetailPage({
  orgSlug,
  skillKey,
}: SkillLibraryDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const { data } = useSuspenseQuery(
    workspaceSkillLibraryDetailQueryOptions({
      orgSlug,
      skillKey,
    }),
  )

  if (!data.detail) {
    return (
      <SettingsPage>
        <SettingsPageContent className="flex max-w-4xl flex-col gap-6 pb-8">
          <SkillsNavigation currentSection="library" orgSlug={orgSlug} />
          <Alert>
            <AlertTitle>Library skill not found</AlertTitle>
            <AlertDescription>
              This skill is not available in the library for this workspace.
            </AlertDescription>
          </Alert>
        </SettingsPageContent>
      </SettingsPage>
    )
  }

  const detail = data.detail

  function handleInstall() {
    startTransition(() => {
      void installWorkspaceLibrarySkill({
        orgSlug,
        skillKey: detail.skillKey,
      })
        .then(async (result) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: workspaceSkillsQueryOptions(orgSlug).queryKey,
            }),
            queryClient.invalidateQueries({
              queryKey: workspaceSkillLibraryDetailQueryOptions({
                orgSlug,
                skillKey: detail.skillKey,
              }).queryKey,
            }),
          ])

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
    })
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-4xl flex-col gap-6 pb-8">
        <SkillsNavigation currentSection="library" orgSlug={orgSlug} />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SettingsPageTitle>{detail.displayName}</SettingsPageTitle>
            <Badge variant={detail.installed ? "default" : "outline"}>
              {detail.installed ? "Installed" : "Available"}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {detail.description}
          </p>
        </div>

        <Alert>
          <AlertTitle>About this skill</AlertTitle>
          <AlertDescription>{detail.summary}</AlertDescription>
        </Alert>

        <Alert>
          <AlertTitle>Dependencies</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Integrations:{" "}
              {detail.dependencies.integrations.length > 0
                ? detail.dependencies.integrations.join(", ")
                : "None"}
            </span>
            <span>
              Skills:{" "}
              {detail.dependencies.skills.length > 0
                ? detail.dependencies.skills.join(", ")
                : "None"}
            </span>
          </AlertDescription>
        </Alert>

        <SettingsSection>
          <SettingsSectionTitle>Included files</SettingsSectionTitle>
          <SettingsSectionDescription>
            Review what will be installed into this workspace with the skill.
          </SettingsSectionDescription>
          <div className="flex flex-wrap gap-2">
            {detail.files.map((file) => (
              <Badge key={file.path} variant="outline">
                {file.fileClass === "managed_entry"
                  ? "Instructions"
                  : file.resettable
                    ? "Template file"
                    : "Included file"}
                : {file.path}
              </Badge>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Instructions preview</SettingsSectionTitle>
          <SettingsSectionDescription>
            This is the main guidance the agent will read after install.
          </SettingsSectionDescription>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap">
            {detail.skillBody}
          </pre>
        </SettingsSection>

        <div className="flex flex-wrap gap-3">
          {detail.installed ? (
            <Link
              params={{
                orgSlug,
                skillKey: detail.skillKey,
              }}
              to="/$orgSlug/skills/$skillKey/overview"
            >
              <Button type="button" variant="outline">
                Open installed skill
              </Button>
            </Link>
          ) : (
            <Button
              disabled={!detail.installable || isPending}
              onClick={handleInstall}
              type="button"
            >
              Install skill
            </Button>
          )}
          <Link params={{ orgSlug }} to="/$orgSlug/skills/library">
            <Button type="button" variant="ghost">
              Back to library
            </Button>
          </Link>
        </div>
      </SettingsPageContent>
    </SettingsPage>
  )
}
