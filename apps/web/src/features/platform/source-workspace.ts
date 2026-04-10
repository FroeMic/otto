import { useLocation } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"

const PLATFORM_SOURCE_WORKSPACE_STORAGE_KEY = "otto.platform.source-workspace"

export const PLATFORM_SOURCE_WORKSPACE_SEARCH_PARAM = "workspace"

export interface WorkspaceSummaryForPlatformSource {
  slug: string
}

function resolveWorkspaceSlug(
  candidate: string | null,
  organizations: WorkspaceSummaryForPlatformSource[],
) {
  if (!candidate) {
    return null
  }

  return organizations.some((organization) => organization.slug === candidate)
    ? candidate
    : null
}

export function getPlatformOrganizationsHref(workspaceSlug: string) {
  const searchParams = new URLSearchParams({
    [PLATFORM_SOURCE_WORKSPACE_SEARCH_PARAM]: workspaceSlug,
  })

  return `/platform/organizations?${searchParams.toString()}`
}

export function usePlatformSourceWorkspaceSlug(
  organizations: WorkspaceSummaryForPlatformSource[],
) {
  const location = useLocation()
  const workspaceFromSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    return resolveWorkspaceSlug(
      searchParams.get(PLATFORM_SOURCE_WORKSPACE_SEARCH_PARAM),
      organizations,
    )
  }, [location.search, organizations])
  const [storedWorkspaceSlug, setStoredWorkspaceSlug] = useState<string | null>(
    null,
  )

  useEffect(() => {
    const storedValue = window.sessionStorage.getItem(
      PLATFORM_SOURCE_WORKSPACE_STORAGE_KEY,
    )

    setStoredWorkspaceSlug(resolveWorkspaceSlug(storedValue, organizations))
  }, [organizations])

  useEffect(() => {
    if (!workspaceFromSearchParams) {
      return
    }

    window.sessionStorage.setItem(
      PLATFORM_SOURCE_WORKSPACE_STORAGE_KEY,
      workspaceFromSearchParams,
    )
    setStoredWorkspaceSlug(workspaceFromSearchParams)
  }, [workspaceFromSearchParams])

  return (
    workspaceFromSearchParams ??
    storedWorkspaceSlug ??
    organizations[0]?.slug ??
    null
  )
}
