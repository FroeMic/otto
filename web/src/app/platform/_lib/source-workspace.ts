"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const PLATFORM_SOURCE_WORKSPACE_STORAGE_KEY = "otto.platform.source-workspace";

export const PLATFORM_SOURCE_WORKSPACE_SEARCH_PARAM = "workspace";

type WorkspaceSummary = {
  slug: string;
};

function resolveWorkspaceSlug(
  candidate: string | null,
  organizations: WorkspaceSummary[],
) {
  if (!candidate) {
    return null;
  }

  return organizations.some((organization) => organization.slug === candidate)
    ? candidate
    : null;
}

export function getPlatformOrganizationsHref(workspaceSlug: string) {
  const searchParams = new URLSearchParams({
    [PLATFORM_SOURCE_WORKSPACE_SEARCH_PARAM]: workspaceSlug,
  });

  return `/platform/organizations?${searchParams.toString()}`;
}

export function usePlatformSourceWorkspaceSlug(
  organizations: WorkspaceSummary[],
) {
  const searchParams = useSearchParams();
  const workspaceFromSearchParams = resolveWorkspaceSlug(
    searchParams.get(PLATFORM_SOURCE_WORKSPACE_SEARCH_PARAM),
    organizations,
  );
  const [storedWorkspaceSlug, setStoredWorkspaceSlug] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const storedValue = window.sessionStorage.getItem(
      PLATFORM_SOURCE_WORKSPACE_STORAGE_KEY,
    );

    setStoredWorkspaceSlug(resolveWorkspaceSlug(storedValue, organizations));
  }, [organizations]);

  useEffect(() => {
    if (!workspaceFromSearchParams) {
      return;
    }

    window.sessionStorage.setItem(
      PLATFORM_SOURCE_WORKSPACE_STORAGE_KEY,
      workspaceFromSearchParams,
    );
    setStoredWorkspaceSlug(workspaceFromSearchParams);
  }, [workspaceFromSearchParams]);

  return (
    workspaceFromSearchParams ??
    storedWorkspaceSlug ??
    organizations[0]?.slug ??
    null
  );
}
