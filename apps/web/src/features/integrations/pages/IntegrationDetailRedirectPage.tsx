import { Navigate } from "@tanstack/react-router"

export interface IntegrationDetailRedirectPageProps {
  integrationKey: string
  orgSlug: string
}

export function IntegrationDetailRedirectPage({
  integrationKey,
  orgSlug,
}: IntegrationDetailRedirectPageProps) {
  return (
    <Navigate
      params={{
        integrationKey,
        orgSlug,
        section: "status",
      }}
      replace
      to="/$orgSlug/settings/agent/integrations/$integrationKey/$section"
    />
  )
}
