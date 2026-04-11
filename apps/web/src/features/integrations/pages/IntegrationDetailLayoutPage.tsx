import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { workspaceIntegrationDetailQueryOptions } from "../api/integrations"
import { integrationDetailRegistry } from "../registry"

export interface IntegrationDetailLayoutPageProps {
  integrationKey: string
  orgSlug: string
  section: string
}

export function IntegrationDetailLayoutPage({
  integrationKey,
  orgSlug,
  section,
}: IntegrationDetailLayoutPageProps) {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(
    workspaceIntegrationDetailQueryOptions({
      integrationKey,
      orgSlug,
    }),
  )
  const DetailPage = integrationDetailRegistry[data.integration.key]
  const currentSection = data.availableSections.includes(section)
    ? section
    : "status"

  return (
    <DetailPage
      currentSection={currentSection}
      detail={data}
      onSectionChange={(nextSection) => {
        if (!data.availableSections.includes(nextSection)) {
          return
        }

        void navigate({
          params: {
            integrationKey,
            orgSlug,
            section: nextSection,
          },
          replace: true,
          to: "/$orgSlug/settings/agent/integrations/$integrationKey/$section",
        })
      }}
      orgSlug={orgSlug}
    />
  )
}
