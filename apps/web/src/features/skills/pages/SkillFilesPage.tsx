import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsPageContent,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RuntimeFileBrowser } from "@/features/files/components/RuntimeFileBrowser"

import { buildWorkspaceSkillFileDownloadUrl, workspaceSkillFilesQueryOptions } from "../api/skill-files"
import { workspaceSkillDetailQueryOptions } from "../api/skills"
import { SkillDetailNavigation } from "../components/SkillDetailNavigation"

export interface SkillFilesPageProps {
  orgSlug: string
  skillKey: string
}

export function SkillFilesPage({ orgSlug, skillKey }: SkillFilesPageProps) {
  const navigate = useNavigate()
  const detailQuery = useSuspenseQuery(
    workspaceSkillDetailQueryOptions({
      orgSlug,
      skillKey,
    }),
  )
  const filesQuery = useSuspenseQuery(
    workspaceSkillFilesQueryOptions({
      orgSlug,
      skillKey,
    }),
  )

  if (
    detailQuery.data.state === "pending_setup" ||
    !detailQuery.data.detail ||
    filesQuery.data.state === "pending_setup" ||
    !filesQuery.data.snapshot
  ) {
    return (
      <SettingsPage>
        <SettingsPageContent className="flex max-w-4xl flex-col gap-6 pb-8">
          <Alert>
            <AlertTitle>Runtime not ready</AlertTitle>
            <AlertDescription>
              This workspace does not have a ready runtime yet, so the skill
              files cannot be inspected here.
            </AlertDescription>
          </Alert>
        </SettingsPageContent>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-6xl flex-col gap-6 pb-8">
        <SkillDetailNavigation
          currentSection="files"
          onSectionChange={(nextSection) => {
            void navigate({
              params: {
                orgSlug,
                skillKey,
              },
              to:
                nextSection === "files"
                  ? "/$orgSlug/skills/$skillKey/files"
                  : nextSection === "instructions"
                    ? "/$orgSlug/skills/$skillKey/instructions"
                    : "/$orgSlug/skills/$skillKey/overview",
            })
          }}
        />

        <Alert>
          <AlertTitle>Default skill files</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2">
            {detailQuery.data.detail.files.map((file) => (
              <Badge key={file.path} variant="outline">
                {file.fileClass === "managed_entry"
                  ? "Instructions"
                  : "Template file"}
                : {file.path}
              </Badge>
            ))}
          </AlertDescription>
        </Alert>

        <RuntimeFileBrowser
          buildDownloadUrl={(input) =>
            buildWorkspaceSkillFileDownloadUrl({
              disposition: input.disposition,
              kind: input.kind,
              orgSlug,
              path: input.path,
              skillKey,
            })
          }
          explorerLabel={detailQuery.data.detail.displayName}
          isRefreshing={filesQuery.isRefetching}
          missingRootMessage="The projected skill directory has not appeared on the runtime yet."
          onRefresh={() => filesQuery.refetch()}
          rootPathFallback={`skills/${skillKey}`}
          snapshot={filesQuery.data.snapshot}
        />
      </SettingsPageContent>
    </SettingsPage>
  )
}
