import { Navigate } from "@tanstack/react-router"

export interface LegacyFilesRedirectPageProps {
  orgSlug: string
}

export function LegacyFilesRedirectPage({
  orgSlug,
}: LegacyFilesRedirectPageProps) {
  return (
    <Navigate
      params={{ orgSlug }}
      replace
      to="/$orgSlug/settings/agent/files"
    />
  )
}
