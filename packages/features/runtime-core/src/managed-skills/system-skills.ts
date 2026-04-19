export type SystemManagedSkillDefinition = {
  files: Array<{
    contentText?: string | null
    path: string
  }>
  installMode: "default_installed" | "manual_install"
  skillKey: string
  summary: string
  visibleInLibrary: boolean
}

export { SYSTEM_MANAGED_SKILL_DEFINITIONS } from "./generated-system-skills"
