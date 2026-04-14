import { NAME_AND_DOMAIN_RESEARCH_SKILL_DEFINITION } from "./library/name-and-domain-research";
import { SKILL_CREATOR_SKILL_DEFINITION } from "./library/skill-creator";
import type { SystemManagedSkillDefinition } from "./system-skill-definition";

export const DEFAULT_BUNDLED_SKILL_ALLOWLIST = ["slack"] as const;

export const SYSTEM_MANAGED_SKILL_DEFINITIONS: readonly SystemManagedSkillDefinition[] =
  [
    SKILL_CREATOR_SKILL_DEFINITION,
    NAME_AND_DOMAIN_RESEARCH_SKILL_DEFINITION,
  ] as const;
