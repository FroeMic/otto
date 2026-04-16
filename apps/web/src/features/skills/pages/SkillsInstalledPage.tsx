import { SkillsPage } from "./SkillsPage"

export interface SkillsInstalledPageProps {
  orgSlug: string
}

export function SkillsInstalledPage({ orgSlug }: SkillsInstalledPageProps) {
  return <SkillsPage currentSection="installed" orgSlug={orgSlug} />
}
