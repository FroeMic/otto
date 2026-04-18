import { Navigate } from "@tanstack/react-router"

export interface SkillInstructionsPageProps {
  orgSlug: string
  skillKey: string
}

export function SkillInstructionsPage({
  orgSlug,
  skillKey,
}: SkillInstructionsPageProps) {
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
