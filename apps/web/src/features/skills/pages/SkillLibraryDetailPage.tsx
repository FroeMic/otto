import type { RuntimeDirectorySnapshot } from "@otto/feature-runtime-core/runtime-files/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsPageContent,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RuntimeFileBrowser } from "@/features/files/components/RuntimeFileBrowser"

import { workspaceSkillLibraryDetailQueryOptions } from "../api/skills"
import { SkillDependencyChips } from "../components/SkillDependencyChips"
import { SkillDetailHeader } from "../components/SkillDetailHeader"
import type { WorkspaceSkillLibraryDetail } from "../types"

export interface SkillLibraryDetailPageProps {
  orgSlug: string
  skillKey: string
}

export function SkillLibraryDetailPage({
  orgSlug,
  skillKey,
}: SkillLibraryDetailPageProps) {
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

  if (data.detail.installed) {
    return (
      <Navigate
        params={{
          orgSlug,
          skillKey: data.detail.skillKey,
        }}
        replace
        to="/$orgSlug/skills/$skillKey/files"
      />
    )
  }

  const snapshot = buildLibraryPreviewSnapshot(data.detail)

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-6xl flex-col gap-6 pb-8">
        <SkillDetailHeader
          detail={data.detail}
          mode="library"
          orgSlug={orgSlug}
        />
        <SkillDependencyChips
          integrations={data.detail.dependencies.integrations}
          skills={data.detail.dependencies.skills}
        />
        <RuntimeFileBrowser
          buildDownloadUrl={(input) =>
            buildLibraryPreviewDownloadUrl({
              path: input.path,
              snapshot,
            })
          }
          emptyDirectoryMessage="This library skill does not include previewable files."
          explorerLabel={data.detail.displayName}
          isRefreshing={false}
          missingRootMessage="This library skill does not include a file preview yet."
          onRefresh={() => undefined}
          preferredFilePath="SKILL.md"
          rootPathFallback={`skills/${data.detail.skillKey}`}
          snapshot={snapshot}
        />
      </SettingsPageContent>
    </SettingsPage>
  )
}

function buildLibraryPreviewSnapshot(
  detail: WorkspaceSkillLibraryDetail,
): RuntimeDirectorySnapshot {
  return {
    files: detail.files.map((file) => ({
      contentText: file.contentText,
      contentType: file.contentType,
      path: file.path,
      sizeBytes: file.contentText
        ? new TextEncoder().encode(file.contentText).byteLength
        : 0,
      storageEncoding: file.storageEncoding,
      truncated: false,
    })),
    rootExists: true,
    rootPath: `skills/${detail.skillKey}`,
  }
}

function buildLibraryPreviewDownloadUrl(input: {
  path: string
  snapshot: RuntimeDirectorySnapshot
}) {
  const file = input.snapshot.files.find((entry) => entry.path === input.path)

  if (!file || file.storageEncoding !== "utf8_text" || file.contentText === null) {
    return "#"
  }

  const contentType = file.contentType ?? "text/plain"

  return `data:${contentType};charset=utf-8,${encodeURIComponent(file.contentText)}`
}
