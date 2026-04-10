"use client";

import { useEffect } from "react";

import {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { useSetBreadcrumbs } from "@/components/breadcrumb-context";
import { RuntimeFileBrowser } from "@/components/runtime-file-browser";
import { MANAGED_BOOTSTRAP_FILE_PATHS } from "@/lib/openclaw/managed-config";

const HIDDEN_WORKSPACE_FILE_PATHS = [
  ...MANAGED_BOOTSTRAP_FILE_PATHS,
  "USERS.md",
];
const HIDDEN_WORKSPACE_FILE_PREFIXES = [".openclaw/"];

export function WorkspaceFilesContent({ orgSlug }: { orgSlug: string }) {
  const setBreadcrumbs = useSetBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  return (
    <SettingsPage className="mx-0 flex max-w-none flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <SettingsPageTitle>Files</SettingsPageTitle>
        <p className="max-w-4xl text-sm text-muted-foreground">
          Browse the workspace directory exactly as it exists on the tenant
          runtime. This view is read-only for now.
        </p>
      </div>

      <SettingsSection>
        <SettingsSectionTitle>Workspace files</SettingsSectionTitle>
        <SettingsSectionDescription>
          Explore the runtime workspace with a file tree on the left and a
          read-only editor on the right.
        </SettingsSectionDescription>
        <RuntimeFileBrowser
          downloadPath={`/api/workspace/${encodeURIComponent(orgSlug)}/files/download`}
          explorerLabel="workspace"
          fetchPath={`/api/workspace/${encodeURIComponent(orgSlug)}/files`}
          hiddenPathPrefixes={HIDDEN_WORKSPACE_FILE_PREFIXES}
          hiddenPaths={HIDDEN_WORKSPACE_FILE_PATHS}
          loadingMessage="Loading workspace files…"
          missingRootMessage="The runtime workspace directory has not appeared yet."
          rootPathFallback="/opt/openclaw/home/workspace"
        />
      </SettingsSection>
    </SettingsPage>
  );
}
