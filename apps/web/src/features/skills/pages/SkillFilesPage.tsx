import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsPageContent,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RuntimeFileBrowser } from "@/features/files/components/RuntimeFileBrowser"

import {
  buildWorkspaceSkillFileDownloadUrl,
  workspaceSkillFilesQueryOptions,
} from "../api/skill-files"
import { workspaceSkillDetailQueryOptions } from "../api/skills"
import { SkillDetailNavigation } from "../components/SkillDetailNavigation"
import { summarizeSkillFileProvenance } from "../file-provenance"

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

  const provenance = summarizeSkillFileProvenance({
    managedFiles: detailQuery.data.detail.files,
    runtimeFiles: filesQuery.data.snapshot.files,
  })

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
          <AlertTitle>Included by this skill</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2">
            {provenance.instructionsFile ? (
              <Badge variant="outline">
                Instructions: {provenance.instructionsFile.path}
              </Badge>
            ) : null}
            {provenance.templateFiles.map((file) => (
              <Badge key={file.path} variant="outline">
                {file.resettable ? "Template default" : "Included file"}:{" "}
                {file.path}
              </Badge>
            ))}
          </AlertDescription>
        </Alert>

        {provenance.runtimeOnlyFiles.length > 0 ? (
          <Alert>
            <AlertTitle>Runtime-only files</AlertTitle>
            <AlertDescription className="flex flex-wrap gap-2">
              {provenance.runtimeOnlyFiles.map((file) => (
                <Badge key={file.path} variant="secondary">
                  {file.path}
                </Badge>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        {provenance.missingFromRuntime.length > 0 ? (
          <Alert>
            <AlertTitle>Not currently present in runtime</AlertTitle>
            <AlertDescription className="flex flex-wrap gap-2">
              {provenance.missingFromRuntime.map((file) => (
                <Badge key={file.path} variant="outline">
                  {file.path}
                </Badge>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

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
          pathDisplayNames={{
            [`skills/${skillKey}`]: toSkillDirectoryDisplayName(
              detailQuery.data.detail.displayName,
              skillKey,
            ),
          }}
          rootPathFallback={`skills/${skillKey}`}
          snapshot={filesQuery.data.snapshot}
        />
      </SettingsPageContent>
    </SettingsPage>
  )
}

function toSkillDirectoryDisplayName(displayName: string, fallback: string) {
  const normalized = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || fallback
}
