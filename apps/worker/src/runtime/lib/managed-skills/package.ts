import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";

import { listIntegrationDefinitions } from "../../integrations/framework";
import { listToolDefinitions } from "../../tools";

export const MANAGED_SKILL_ENTRY_FILE_PATH = "SKILL.md";

export type ManagedSkillFileKind = "managed" | "state";
export type ManagedSkillFileContentEncoding = "utf8_text" | "binary";
export type ManagedSkillFileEditability =
  | "download_only"
  | "editable"
  | "local_state";
export type ManagedSkillStatus =
  | "disabled"
  | "invalid"
  | "missing_prerequisite"
  | "projection_failed"
  | "ready";
export type ManagedSkillSourceType =
  | "integration_contribution"
  | "system"
  | "user";

export type ManagedSkillPackageFileInput = {
  contentText?: string | null;
  contentType?: string | null;
  path: string;
};

export type ManagedSkillValidatedFile = {
  contentSha256: string | null;
  contentText: string | null;
  contentType: string | null;
  editability: ManagedSkillFileEditability;
  fileKind: ManagedSkillFileKind;
  path: string;
  storageEncoding: ManagedSkillFileContentEncoding;
};

export type ManagedSkillPackageValidationResult = {
  dependencies: {
    integrations: string[];
    skills: string[];
  };
  description: string;
  files: ManagedSkillValidatedFile[];
  name: string;
  skillBody: string;
  skillKey: string;
};

export type ManagedSkillMarkdownDocument = {
  description: string;
  integrationKeys: string[];
  name: string;
  skillKeys: string[];
  skillBody: string;
};

type ParsedFrontmatter = {
  description: string;
  metadata: {
    dependsOn: {
      integrations: string[];
      skills: string[];
    };
  };
  name: string;
};

const skillDependencyMetadataSchema = z
  .object({
    dependsOn: z
      .object({
        integrations: z.array(z.string()).optional(),
        skills: z.array(z.string()).optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

export function listKnownManagedSkillDependencyIntegrationKeys() {
  const keys = new Set<string>();

  for (const definition of listIntegrationDefinitions()) {
    keys.add(definition.key);
  }

  for (const definition of listToolDefinitions()) {
    if (
      definition.surfaceType === "integration" &&
      definition.uiGroup === "integrations"
    ) {
      keys.add(definition.key);
    }
  }

  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function normalizeManagedSkillKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(
      "skill_key must be a stable slug using lowercase letters, numbers, and hyphens.",
    );
  }

  return normalized;
}

export function normalizeManagedSkillFilePath(value: string) {
  const trimmedValue = value.trim().replaceAll("\\", "/");

  if (!trimmedValue) {
    throw new Error("Skill file path cannot be empty.");
  }

  if (trimmedValue.startsWith("/")) {
    throw new Error("Skill file path must be relative.");
  }

  const normalizedValue = path.posix.normalize(trimmedValue);

  if (
    normalizedValue === "." ||
    normalizedValue === ".." ||
    normalizedValue.startsWith("../") ||
    normalizedValue.includes("/../") ||
    normalizedValue.includes("/./")
  ) {
    throw new Error("Skill file path must stay inside the skill package.");
  }

  return normalizedValue;
}

export function classifyManagedSkillFile(input: ManagedSkillPackageFileInput): {
  editability: ManagedSkillFileEditability;
  fileKind: ManagedSkillFileKind;
  path: string;
  storageEncoding: ManagedSkillFileContentEncoding;
} {
  const normalizedPath = normalizeManagedSkillFilePath(input.path);
  const isStatePath =
    normalizedPath === "state" || normalizedPath.startsWith("state/");
  const isUtf8Text = typeof input.contentText === "string";

  if (isStatePath) {
    return {
      editability: "local_state",
      fileKind: "state",
      path: normalizedPath,
      storageEncoding: isUtf8Text ? "utf8_text" : "binary",
    };
  }

  return {
    editability:
      isUtf8Text && normalizedPath === MANAGED_SKILL_ENTRY_FILE_PATH
        ? "editable"
        : "download_only",
    fileKind: "managed",
    path: normalizedPath,
    storageEncoding: isUtf8Text ? "utf8_text" : "binary",
  };
}

export function validateManagedSkillPackage(input: {
  files: ManagedSkillPackageFileInput[];
  knownIntegrationKeys?: Iterable<string>;
  knownSkillKeys?: Iterable<string>;
  skillKey: string;
}): ManagedSkillPackageValidationResult {
  const knownIntegrationKeys = new Set(
    input.knownIntegrationKeys ??
      listKnownManagedSkillDependencyIntegrationKeys(),
  );
  const knownSkillKeys = new Set(input.knownSkillKeys ?? []);
  const skillKey = normalizeManagedSkillKey(input.skillKey);
  const validatedFiles = new Map<string, ManagedSkillValidatedFile>();

  for (const file of input.files) {
    const classification = classifyManagedSkillFile(file);

    if (classification.fileKind === "state") {
      throw new Error(
        `Managed skill writes cannot target reserved local state path: ${classification.path}`,
      );
    }

    if (classification.path !== MANAGED_SKILL_ENTRY_FILE_PATH) {
      throw new Error(
        `Only ${MANAGED_SKILL_ENTRY_FILE_PATH} can be stored as managed skill content.`,
      );
    }

    if (validatedFiles.has(classification.path)) {
      throw new Error(
        `Duplicate managed skill file path: ${classification.path}`,
      );
    }

    const contentText =
      typeof file.contentText === "string" ? file.contentText : null;

    validatedFiles.set(classification.path, {
      contentSha256: contentText ? createTextChecksum(contentText) : null,
      contentText,
      contentType: file.contentType ?? null,
      editability: classification.editability,
      fileKind: classification.fileKind,
      path: classification.path,
      storageEncoding: classification.storageEncoding,
    });
  }

  const skillFile = validatedFiles.get(MANAGED_SKILL_ENTRY_FILE_PATH);

  if (!skillFile?.contentText) {
    throw new Error("Managed skill package must include a text SKILL.md file.");
  }

  const parsedSkill = parseManagedSkillSkillFile(skillFile.contentText);
  const unknownDependencies =
    parsedSkill.metadata.dependsOn.integrations.filter(
      (integrationKey) => !knownIntegrationKeys.has(integrationKey),
    );
  const unknownSkillDependencies = parsedSkill.metadata.dependsOn.skills.filter(
    (dependencySkillKey) => !knownSkillKeys.has(dependencySkillKey),
  );

  if (unknownDependencies.length > 0) {
    throw new Error(
      `Managed skill depends on unknown integration keys: ${unknownDependencies.join(", ")}`,
    );
  }

  if (unknownSkillDependencies.length > 0) {
    throw new Error(
      `Managed skill depends on unknown skill keys: ${unknownSkillDependencies.join(", ")}`,
    );
  }

  if (parsedSkill.metadata.dependsOn.skills.includes(skillKey)) {
    throw new Error("Managed skill cannot depend on itself.");
  }

  return {
    dependencies: {
      integrations: parsedSkill.metadata.dependsOn.integrations,
      skills: parsedSkill.metadata.dependsOn.skills,
    },
    description: parsedSkill.description,
    files: [...validatedFiles.values()].sort((left, right) =>
      left.path.localeCompare(right.path),
    ),
    name: parsedSkill.name,
    skillBody: extractManagedSkillFrontmatter(skillFile.contentText).body,
    skillKey,
  };
}

export function parseManagedSkillSkillFile(
  contentText: string,
): ParsedFrontmatter {
  const { frontmatter } = extractManagedSkillFrontmatter(contentText);
  const parsedFrontmatter = parseSimpleYamlFrontmatter(frontmatter);
  const name =
    typeof parsedFrontmatter.name === "string"
      ? parsedFrontmatter.name.trim()
      : "";
  const description =
    typeof parsedFrontmatter.description === "string"
      ? parsedFrontmatter.description.trim()
      : "";

  if (!name) {
    throw new Error("SKILL.md frontmatter must include a non-empty name.");
  }

  if (!description) {
    throw new Error(
      "SKILL.md frontmatter must include a non-empty description.",
    );
  }

  const metadata = skillDependencyMetadataSchema.parse(
    parsedFrontmatter.metadata,
  );
  const integrations = [...new Set(metadata.dependsOn?.integrations ?? [])].map(
    (integrationKey) => integrationKey.trim().toLowerCase(),
  );
  const skills = [...new Set(metadata.dependsOn?.skills ?? [])].map(
    (skillKey) => skillKey.trim().toLowerCase(),
  );

  if (integrations.some((integrationKey) => !integrationKey)) {
    throw new Error(
      "metadata.dependsOn.integrations must contain only non-empty strings.",
    );
  }

  if (skills.some((skillKey) => !skillKey)) {
    throw new Error(
      "metadata.dependsOn.skills must contain only non-empty strings.",
    );
  }

  return {
    description,
    metadata: {
      dependsOn: {
        integrations,
        skills,
      },
    },
    name,
  };
}

export function parseManagedSkillMarkdown(
  contentText: string,
): ManagedSkillMarkdownDocument {
  const parsedSkill = parseManagedSkillSkillFile(contentText);
  const { body } = extractManagedSkillFrontmatter(contentText);

  return {
    description: parsedSkill.description,
    integrationKeys: parsedSkill.metadata.dependsOn.integrations,
    name: parsedSkill.name,
    skillKeys: parsedSkill.metadata.dependsOn.skills,
    skillBody: body.trim(),
  };
}

export function buildManagedSkillMarkdown(input: {
  description: string;
  integrationKeys: string[];
  name: string;
  skillKeys: string[];
  skillBody: string;
}) {
  const normalizedIntegrationKeys = [...new Set(input.integrationKeys)]
    .map((integrationKey) => integrationKey.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const normalizedSkillKeys = [...new Set(input.skillKeys)]
    .map((skillKey) => skillKey.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const lines = [
    "---",
    `name: ${input.name.trim()}`,
    `description: ${input.description.trim()}`,
    "metadata:",
    "  dependsOn:",
  ];

  if (normalizedIntegrationKeys.length === 0) {
    lines.push("    integrations: []");
  } else {
    lines.push("    integrations:");
    for (const integrationKey of normalizedIntegrationKeys) {
      lines.push(`      - ${integrationKey}`);
    }
  }

  if (normalizedSkillKeys.length === 0) {
    lines.push("    skills: []");
  } else {
    lines.push("    skills:");
    for (const skillKey of normalizedSkillKeys) {
      lines.push(`      - ${skillKey}`);
    }
  }

  lines.push("---", "", input.skillBody.trim(), "");

  return `${lines.join("\n")}`;
}

function createTextChecksum(contentText: string) {
  return createHash("sha256").update(contentText).digest("hex");
}

function extractManagedSkillFrontmatter(contentText: string) {
  const normalized = contentText.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    throw new Error("SKILL.md must begin with YAML frontmatter.");
  }

  const frontmatterEnd = normalized.indexOf("\n---\n", 4);

  if (frontmatterEnd === -1) {
    throw new Error("SKILL.md frontmatter must end with a closing --- line.");
  }

  return {
    body: normalized.slice(frontmatterEnd + 5),
    frontmatter: normalized.slice(4, frontmatterEnd),
  };
}

function parseSimpleYamlFrontmatter(frontmatter: string) {
  const lines = frontmatter.split("\n");
  const [parsed] = parseYamlBlock(lines, 0, 0);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("SKILL.md frontmatter must parse to an object.");
  }

  return parsed as Record<string, unknown>;
}

function parseYamlBlock(
  lines: string[],
  startIndex: number,
  indent: number,
): [unknown, number] {
  const index = skipBlankLines(lines, startIndex);

  if (index >= lines.length) {
    return [{}, index];
  }

  const currentIndent = countIndent(lines[index]);

  if (currentIndent < indent) {
    return [{}, index];
  }

  if (lines[index].trimStart().startsWith("- ")) {
    return parseYamlList(lines, index, currentIndent);
  }

  return parseYamlObject(lines, index, currentIndent);
}

function parseYamlObject(
  lines: string[],
  startIndex: number,
  indent: number,
): [Record<string, unknown>, number] {
  const objectValue: Record<string, unknown> = {};
  let index = startIndex;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    const lineIndent = countIndent(lines[index]);

    if (lineIndent < indent) {
      break;
    }

    if (lineIndent > indent) {
      throw new Error(`Unexpected indentation in SKILL.md frontmatter.`);
    }

    const trimmedLine = lines[index].trim();

    if (trimmedLine.startsWith("- ")) {
      throw new Error("Invalid list item placement in SKILL.md frontmatter.");
    }

    const separatorIndex = trimmedLine.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line: ${trimmedLine}`);
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const restValue = trimmedLine.slice(separatorIndex + 1).trim();

    if (!key) {
      throw new Error(`Invalid frontmatter line: ${trimmedLine}`);
    }

    index += 1;

    if (restValue) {
      objectValue[key] = parseYamlScalar(restValue);
      continue;
    }

    const nextIndex = skipBlankLines(lines, index);

    if (
      nextIndex >= lines.length ||
      countIndent(lines[nextIndex]) <= lineIndent
    ) {
      objectValue[key] = null;
      index = nextIndex;
      continue;
    }

    const [nestedValue, nestedIndex] = parseYamlBlock(
      lines,
      nextIndex,
      countIndent(lines[nextIndex]),
    );
    objectValue[key] = nestedValue;
    index = nestedIndex;
  }

  return [objectValue, index];
}

function parseYamlList(
  lines: string[],
  startIndex: number,
  indent: number,
): [unknown[], number] {
  const listValue: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    const lineIndent = countIndent(lines[index]);

    if (lineIndent < indent) {
      break;
    }

    if (lineIndent > indent) {
      throw new Error("Unexpected indentation inside SKILL.md list.");
    }

    const trimmedLine = lines[index].trim();

    if (!trimmedLine.startsWith("- ")) {
      break;
    }

    const itemValue = trimmedLine.slice(2).trim();
    index += 1;

    if (itemValue) {
      listValue.push(parseYamlScalar(itemValue));
      continue;
    }

    const nextIndex = skipBlankLines(lines, index);

    if (
      nextIndex >= lines.length ||
      countIndent(lines[nextIndex]) <= lineIndent
    ) {
      listValue.push(null);
      index = nextIndex;
      continue;
    }

    const [nestedValue, nestedIndex] = parseYamlBlock(
      lines,
      nextIndex,
      countIndent(lines[nextIndex]),
    );
    listValue.push(nestedValue);
    index = nestedIndex;
  }

  return [listValue, index];
}

function parseYamlScalar(value: string): unknown {
  if (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}

function skipBlankLines(lines: string[], index: number) {
  let nextIndex = index;

  while (nextIndex < lines.length && !lines[nextIndex].trim()) {
    nextIndex += 1;
  }

  return nextIndex;
}

function countIndent(value: string) {
  const match = value.match(/^ */);
  return match ? match[0].length : 0;
}
