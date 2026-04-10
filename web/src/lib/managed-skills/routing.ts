export const MANAGED_SKILL_SECTIONS = ["overview", "files", "status"] as const;

export type ManagedSkillSection = (typeof MANAGED_SKILL_SECTIONS)[number];

export function isManagedSkillSection(
  value: string,
): value is ManagedSkillSection {
  return MANAGED_SKILL_SECTIONS.includes(value as ManagedSkillSection);
}

export function buildManagedSkillSectionPath(input: {
  orgSlug: string;
  section: ManagedSkillSection;
  skillKey: string;
}) {
  const orgSlug = encodeURIComponent(input.orgSlug);
  const skillKey = encodeURIComponent(input.skillKey);
  const section = encodeURIComponent(input.section);

  return `/${orgSlug}/skills/${skillKey}/${section}`;
}
