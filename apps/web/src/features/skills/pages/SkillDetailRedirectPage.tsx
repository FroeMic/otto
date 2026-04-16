import { Navigate } from "@tanstack/react-router"

export interface SkillDetailRedirectPageProps {
  orgSlug: string
  skillKey: string
}

export function SkillDetailRedirectPage({
  orgSlug,
  skillKey,
}: SkillDetailRedirectPageProps) {
  return (
    <Navigate
      params={{
        orgSlug,
        skillKey,
      }}
      replace
      to="/$orgSlug/skills/$skillKey/overview"
    />
  )
}
