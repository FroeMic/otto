import { Navigate } from "@tanstack/react-router"

export interface SkillsRedirectPageProps {
  orgSlug: string
}

export function SkillsRedirectPage({ orgSlug }: SkillsRedirectPageProps) {
  return (
    <Navigate
      params={{
        orgSlug,
      }}
      replace
      to="/$orgSlug/skills/installed"
    />
  )
}
