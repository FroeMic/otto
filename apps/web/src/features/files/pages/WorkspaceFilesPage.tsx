import { useSuspenseQuery } from "@tanstack/react-query"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsSectionDescription,
} from "@/client/app/app-shell/SettingsLayout"

import {
  buildWorkspaceFileDownloadUrl,
  workspaceFilesQueryOptions,
} from "../api/files"
import { FilesPendingSetupPage } from "../components/FilesPendingSetupPage"
import { RuntimeFileBrowser } from "../components/RuntimeFileBrowser"
import {
  HIDDEN_WORKSPACE_FILE_PATHS,
  HIDDEN_WORKSPACE_FILE_PREFIXES,
  WORKSPACE_FILES_ROOT_PATH,
} from "../config/workspace-files"

export interface WorkspaceFilesPageProps {
  orgSlug: string
}

export function WorkspaceFilesPage({ orgSlug }: WorkspaceFilesPageProps) {
  const query = useSuspenseQuery(workspaceFilesQueryOptions(orgSlug))

  if (query.data.state === "pending_setup" || !query.data.snapshot) {
    return <FilesPendingSetupPage />
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-6xl flex-col gap-6 pb-8">
        <div className="flex flex-col gap-2">
          <SettingsPageTitle>Files</SettingsPageTitle>
          <SettingsSectionDescription className="max-w-4xl leading-6">
            Browse the workspace directory exactly as it exists on the tenant
            runtime. This view is read-only for now.
          </SettingsSectionDescription>
        </div>

        <RuntimeFileBrowser
          buildDownloadUrl={(input) =>
            buildWorkspaceFileDownloadUrl({
              disposition: input.disposition,
              kind: input.kind,
              orgSlug,
              path: input.path,
            })
          }
          explorerLabel="Workspace files"
          hiddenPathPrefixes={HIDDEN_WORKSPACE_FILE_PREFIXES}
          hiddenPaths={HIDDEN_WORKSPACE_FILE_PATHS}
          isRefreshing={query.isRefetching}
          missingRootMessage="The runtime workspace directory has not appeared yet."
          onRefresh={() => query.refetch()}
          rootPathFallback={WORKSPACE_FILES_ROOT_PATH}
          snapshot={query.data.snapshot}
        />
      </SettingsPageContent>
    </SettingsPage>
  )
}

