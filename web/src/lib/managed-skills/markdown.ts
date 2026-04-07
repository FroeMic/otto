export const MANAGED_SKILL_ENTRY_FILE_PATH = "SKILL.md";

export type ManagedSkillMarkdownDocument = {
  description: string;
  integrationKeys: string[];
  name: string;
  skillBody: string;
};

type ParsedFrontmatter = {
  description: string;
  metadata: {
    dependsOn: {
      integrations: string[];
    };
  };
  name: string;
};

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

  const metadata = normalizeDependencyMetadata(parsedFrontmatter.metadata);
  const integrations = [...new Set(metadata.dependsOn.integrations)].map(
    (integrationKey) => integrationKey.trim().toLowerCase(),
  );

  if (integrations.some((integrationKey) => !integrationKey)) {
    throw new Error(
      "metadata.dependsOn.integrations must contain only non-empty strings.",
    );
  }

  return {
    description,
    metadata: {
      dependsOn: {
        integrations,
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
    skillBody: body.trim(),
  };
}

export function buildManagedSkillMarkdown(input: {
  description: string;
  integrationKeys: string[];
  name: string;
  skillBody: string;
}) {
  const normalizedIntegrationKeys = [...new Set(input.integrationKeys)]
    .map((integrationKey) => integrationKey.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const lines = [
    "---",
    `name: ${input.name.trim()}`,
    `description: ${input.description.trim()}`,
    "metadata:",
    "  dependsOn:",
    "    integrations:",
  ];

  if (normalizedIntegrationKeys.length === 0) {
    lines.push("      []");
  } else {
    for (const integrationKey of normalizedIntegrationKeys) {
      lines.push(`      - ${integrationKey}`);
    }
  }

  lines.push("---", "", input.skillBody.trim(), "");

  return `${lines.join("\n")}`;
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

function normalizeDependencyMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      dependsOn: {
        integrations: [],
      },
    };
  }

  const dependsOn = (value as { dependsOn?: unknown }).dependsOn;

  if (!dependsOn || typeof dependsOn !== "object" || Array.isArray(dependsOn)) {
    return {
      dependsOn: {
        integrations: [],
      },
    };
  }

  const integrations = (dependsOn as { integrations?: unknown }).integrations;

  if (!Array.isArray(integrations)) {
    return {
      dependsOn: {
        integrations: [],
      },
    };
  }

  return {
    dependsOn: {
      integrations: integrations.filter(
        (integrationKey): integrationKey is string =>
          typeof integrationKey === "string",
      ),
    },
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
      throw new Error("Unexpected indentation in SKILL.md frontmatter.");
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

function skipBlankLines(lines: string[], index: number) {
  let nextIndex = index;

  while (nextIndex < lines.length && !lines[nextIndex]?.trim()) {
    nextIndex += 1;
  }

  return nextIndex;
}

function countIndent(line: string) {
  const match = line.match(/^ */);
  return match?.[0].length ?? 0;
}

function parseYamlScalar(value: string) {
  if (value === "[]") {
    return [];
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
