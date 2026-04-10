"use client";

import { RuntimeFileBrowser } from "@/components/runtime-file-browser";

type Props = {
  orgSlug: string;
  skillKey: string;
};

export function ManagedSkillFilesTab({ orgSlug, skillKey }: Props) {
  return (
    <RuntimeFileBrowser
      emptyDirectoryMessage="This skill directory is currently empty."
      explorerLabel={skillKey}
      fetchPath={`/api/workspace/${encodeURIComponent(orgSlug)}/skills/${encodeURIComponent(skillKey)}/files`}
      loadingMessage="Loading skill files…"
      missingRootMessage="This skill package exists in the workspace, but the projected runtime directory has not appeared yet."
      rootPathFallback={`skills/${skillKey}`}
    />
  );
}
