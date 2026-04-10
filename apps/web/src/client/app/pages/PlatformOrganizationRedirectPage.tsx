import { Navigate } from "@tanstack/react-router"

export interface PlatformOrganizationRedirectPageProps {
  orgSlug: string
}

export function PlatformOrganizationRedirectPage({
  orgSlug,
}: PlatformOrganizationRedirectPageProps) {
  return (
    <Navigate
      params={{ platformOrgSlug: orgSlug }}
      to="/platform/organizations/$platformOrgSlug/overview"
    />
  )
}
