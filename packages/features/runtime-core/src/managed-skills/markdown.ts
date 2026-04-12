export const MANAGED_SKILL_ENTRY_FILE_PATH = "SKILL.md"

export interface ManagedSkillMarkdownDocument {
  description: string
  integrationKeys: string[]
  name: string
  skillBody: string
  skillKeys: string[]
}

export function buildManagedSkillMarkdown(input: {
  description: string
  integrationKeys: string[]
  name: string
  skillBody: string
  skillKeys: string[]
}) {
  const normalizedIntegrationKeys = [...new Set(input.integrationKeys)]
    .map((integrationKey) => integrationKey.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
  const normalizedSkillKeys = [...new Set(input.skillKeys)]
    .map((skillKey) => skillKey.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
  const lines = [
    "---",
    `name: ${input.name.trim()}`,
    `description: ${input.description.trim()}`,
    "metadata:",
    "  dependsOn:",
  ]

  if (normalizedIntegrationKeys.length === 0) {
    lines.push("    integrations: []")
  } else {
    lines.push("    integrations:")
    for (const integrationKey of normalizedIntegrationKeys) {
      lines.push(`      - ${integrationKey}`)
    }
  }

  if (normalizedSkillKeys.length === 0) {
    lines.push("    skills: []")
  } else {
    lines.push("    skills:")
    for (const skillKey of normalizedSkillKeys) {
      lines.push(`      - ${skillKey}`)
    }
  }

  lines.push("---", "", input.skillBody.trim(), "")

  return `${lines.join("\n")}`
}

export function parseManagedSkillMarkdown(
  contentText: string,
): ManagedSkillMarkdownDocument {
  const normalized = contentText.replace(/\r\n/g, "\n")
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

  if (!frontmatterMatch) {
    throw new Error("SKILL.md must include YAML frontmatter.")
  }

  const frontmatter = frontmatterMatch[1]
  const body = frontmatterMatch[2]?.trim() ?? ""
  const lines = frontmatter.split("\n")
  const name = getFrontmatterScalar(lines, "name")
  const description = getFrontmatterScalar(lines, "description")

  if (!name || !description) {
    throw new Error("SKILL.md must include non-empty name and description.")
  }

  return {
    description,
    integrationKeys: getFrontmatterList(lines, "integrations"),
    name,
    skillBody: body,
    skillKeys: getFrontmatterList(lines, "skills"),
  }
}

function getFrontmatterScalar(lines: string[], key: string) {
  const prefix = `${key}:`
  const line = lines.find((entry) => entry.trimStart().startsWith(prefix))
  return line ? line.split(":").slice(1).join(":").trim() : ""
}

function getFrontmatterList(lines: string[], key: string) {
  const startIndex = lines.findIndex(
    (entry) => entry.trim() === `${key}:` || entry.trim() === `${key}: []`,
  )

  if (startIndex === -1 || lines[startIndex].trim() === `${key}: []`) {
    return []
  }

  const values: string[] = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed.startsWith("- ")) {
      break
    }

    values.push(trimmed.slice(2).trim())
  }

  return values
}
