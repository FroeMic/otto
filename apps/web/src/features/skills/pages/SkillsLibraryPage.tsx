import { SkillsPage } from "./SkillsPage"

export interface SkillsLibraryPageProps {
  orgSlug: string
}

export function SkillsLibraryPage({ orgSlug }: SkillsLibraryPageProps) {
  return <SkillsPage currentSection="library" orgSlug={orgSlug} />
}
