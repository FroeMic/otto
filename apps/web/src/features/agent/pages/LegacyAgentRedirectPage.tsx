import { Navigate } from "@tanstack/react-router"

export interface LegacyAgentRedirectPageProps {
  instructionTab?: string
  orgSlug: string
}

export function LegacyAgentRedirectPage({
  instructionTab,
  orgSlug,
}: LegacyAgentRedirectPageProps) {
  if (!instructionTab) {
    return (
      <Navigate
        params={{ orgSlug }}
        replace
        to="/$orgSlug/settings/agent/personalization"
      />
    )
  }

  return (
    <Navigate
      params={{
        instructionTab,
        orgSlug,
      }}
      replace
      to="/$orgSlug/settings/agent/personalization/$instructionTab"
    />
  )
}
