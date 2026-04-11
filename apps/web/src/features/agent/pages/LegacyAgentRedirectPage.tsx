import { Navigate } from "@tanstack/react-router"

export interface LegacyAgentRedirectPageProps {
  instructionTab?: string
  orgSlug: string
}

export function LegacyAgentRedirectPage({
  instructionTab,
  orgSlug,
}: LegacyAgentRedirectPageProps) {
  return (
    <Navigate
      params={{
        instructionTab: instructionTab ?? "Agent.md",
        orgSlug,
      }}
      replace
      to="/$orgSlug/settings/agent/personalization/$instructionTab"
    />
  )
}
