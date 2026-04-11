import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate } from "@tanstack/react-router"

import { agentPersonalizationOverviewQueryOptions } from "../api/agent"

export interface AgentPersonalizationRedirectPageProps {
  orgSlug: string
}

export function AgentPersonalizationRedirectPage({
  orgSlug,
}: AgentPersonalizationRedirectPageProps) {
  const { data } = useSuspenseQuery(
    agentPersonalizationOverviewQueryOptions(orgSlug),
  )

  return (
    <Navigate
      params={{
        instructionTab: data.defaultInstructionTab,
        orgSlug,
      }}
      replace
      to="/$orgSlug/settings/agent/personalization/$instructionTab"
    />
  )
}
