import type { ManagedSkillPackageFileInput } from "./package";

export type SystemManagedSkillDefinition = {
  files: ManagedSkillPackageFileInput[];
  skillKey: string;
  summary: string;
};
