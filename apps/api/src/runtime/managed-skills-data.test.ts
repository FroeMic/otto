import assert from "node:assert/strict"

import { beforeEach, describe, expect, it, vi } from "vitest"

const getDb = vi.fn()

vi.mock("@otto/feature-integrations-runtime/db/client", () => ({
  getDb,
}))

vi.mock("@otto/feature-runtime-core", () => ({
  SYSTEM_MANAGED_SKILL_DEFINITIONS: [
    {
      files: [
        {
          contentText:
            "---\nname: Brand Name Generator\ndescription: Founders naming workflow.\nintegrations:\n- brave\n- gandi\nskills: []\n---\n\n# Brand Name Generator\n",
          path: "SKILL.md",
        },
        {
          contentText: "# Setup",
          path: "references/setup.md",
        },
      ],
      installMode: "manual_install",
      skillKey: "name-and-domain-research",
      summary: "Install Otto system founder naming guidance",
      visibleInLibrary: true,
    },
  ],
}))

const { getLatestTenantManagedSkillDetailForTenant, listTenantManagedSkillsForTenant } =
  await import("./managed-skills-data")

function createDbListMock() {
  const orderBy = vi.fn().mockResolvedValue([
    {
      description: "Founders naming workflow",
      displayName: "Brand Name Generator",
      enabled: true,
      skillId: "skill_123",
      skillKey: "name-and-domain-research",
      sourceType: "system",
      status: "ready",
      updatedAt: new Date("2026-04-15T00:00:00.000Z"),
    },
  ])
  const where = vi.fn(() => ({
    orderBy,
  }))
  const from = vi.fn(() => ({
    where,
  }))
  const select = vi
    .fn()
    .mockReturnValueOnce({ from })

  return {
    db: { select },
    select,
  }
}

function createDbDetailMock() {
  const limitSkill = vi.fn().mockResolvedValue([
    {
      description: "Founders naming workflow",
      displayName: "Brand Name Generator",
      enabled: true,
      skillId: "skill_123",
      skillKey: "name-and-domain-research",
      sourceType: "system",
      status: "ready",
      updatedAt: new Date("2026-04-15T00:00:00.000Z"),
    },
  ])
  const whereSkill = vi.fn(() => ({
    limit: limitSkill,
  }))
  const fromSkill = vi.fn(() => ({
    where: whereSkill,
  }))

  const limitVersion = vi.fn().mockResolvedValue([
    {
      id: "version_1",
      summary: "Install Otto system founder naming guidance",
      version: 1,
    },
  ])
  const orderByVersion = vi.fn(() => ({
    limit: limitVersion,
  }))
  const whereVersion = vi.fn(() => ({
    orderBy: orderByVersion,
  }))
  const fromVersion = vi.fn(() => ({
    where: whereVersion,
  }))

  const orderByFiles = vi.fn().mockResolvedValue([
    {
      contentEncoding: "utf8_text",
      contentSha256: "abc123",
      contentText: "---\nname: Brand Name Generator\n---\n",
      contentType: "text/markdown",
      fileKind: "managed_entry",
      relativePath: "SKILL.md",
    },
  ])
  const whereFiles = vi.fn(() => ({
    orderBy: orderByFiles,
  }))
  const innerJoinFiles = vi.fn(() => ({
    where: whereFiles,
  }))
  const fromFiles = vi.fn(() => ({
    innerJoin: innerJoinFiles,
  }))

  const select = vi
    .fn()
    .mockReturnValueOnce({ from: fromSkill })
    .mockReturnValueOnce({ from: fromVersion })
    .mockReturnValueOnce({ from: fromFiles })

  return {
    db: { select },
    select,
  }
}

describe("api managed skill data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not auto-seed manual-install library skills before listing tenant skills", async () => {
    const { db, select } = createDbListMock()
    getDb.mockReturnValue(db)

    const result = await listTenantManagedSkillsForTenant({
      tenantId: "tenant_123",
    })

    expect(select).toHaveBeenCalledTimes(1)
    assert.equal(result[0]?.skillKey, "name-and-domain-research")
  })

  it("reads detail for manual-install library skills without auto-seeding them", async () => {
    const { db, select } = createDbDetailMock()
    getDb.mockReturnValue(db)

    const result = await getLatestTenantManagedSkillDetailForTenant({
      skillKey: "name-and-domain-research",
      tenantId: "tenant_123",
    })

    expect(select).toHaveBeenCalledTimes(3)
    assert.equal(result?.skillKey, "name-and-domain-research")
  })
})
