import assert from "node:assert/strict"

import { beforeEach, describe, expect, it, vi } from "vitest"

const getDb = vi.fn()
const enqueueJob = vi.fn()

vi.mock("@otto/feature-integrations-runtime/db/client", () => ({
  getDb,
}))

vi.mock("../jobs/queue", () => ({
  enqueueJob,
}))

vi.mock("../jobs/types", () => ({
  JOB_TYPES: {
    applyTenantConfig: "apply_tenant_config",
  },
}))

vi.mock("@otto/feature-runtime-core", () => ({
  SYSTEM_MANAGED_SKILL_DEFINITIONS: [
    {
      files: [
        {
          contentText:
            "---\nname: Otto Business Onboarding\ndescription: Founder onboarding workflow.\nintegrations: []\nskills: []\n---\n\n# Otto Business Onboarding\n",
          path: "SKILL.md",
        },
      ],
      installMode: "default_installed",
      skillKey: "otto-business-onboarding",
      summary: "Install Otto business onboarding guidance",
      visibleInLibrary: false,
    },
    {
      files: [
        {
          contentText:
            "---\nname: Name Generator\ndescription: Founders naming workflow.\nintegrations:\n- brave\n- gandi\nskills: []\n---\n\n# Name Generator\n",
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

const {
  createTenantSystemManagedSkillForTenant,
  deleteTenantManagedSkillForTenant,
  getLatestTenantManagedSkillDetailForTenant,
  listTenantManagedSkillsForTenant,
  syncDefaultTenantManagedSkillsForTenant,
} = await import("./managed-skills-data")

function createDbListMock() {
  const ensureDefaultSkill = createSelectChain([
    {
      skillId: "skill_default_1",
    },
  ])
  const orderBy = vi.fn().mockResolvedValue([
    {
      description: "Founders naming workflow",
      displayName: "Name Generator",
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
    .mockReturnValueOnce(ensureDefaultSkill)
    .mockReturnValueOnce({ from })

  return {
    db: { select },
    select,
  }
}

function createDbDetailMock() {
  const ensureDefaultSkill = createSelectChain([
    {
      skillId: "skill_default_1",
    },
  ])
  const limitSkill = vi.fn().mockResolvedValue([
    {
      description: "Founders naming workflow",
      displayName: "Name Generator",
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
      contentText: "---\nname: Name Generator\n---\n",
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
    .mockReturnValueOnce(ensureDefaultSkill)
    .mockReturnValueOnce({ from: fromSkill })
    .mockReturnValueOnce({ from: fromVersion })
    .mockReturnValueOnce({ from: fromFiles })

  return {
    db: { select },
    select,
  }
}

function createSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn(() => chain),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    where: vi.fn(() => chain),
  }

  return chain
}

function createInsertChain(result: unknown[] = []) {
  const chain = {
    returning: vi.fn().mockResolvedValue(result),
    values: vi.fn(() => chain),
  }

  return chain
}

function createDeleteChain() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  }

  return chain
}

function createReadyRuntimeDbMockForInstall() {
  const selectResults = [
    [
      {
        skillId: "skill_default_1",
        sourceType: "system",
      },
    ],
    [],
    [
      {
        skillId: "skill_default_1",
        sourceType: "system",
      },
    ],
    [
      {
        description: "Founders naming workflow",
        displayName: "Name Generator",
        enabled: true,
        skillId: "skill_123",
        skillKey: "name-and-domain-research",
        sourceType: "system",
        status: "ready",
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      },
    ],
    [
      {
        id: "version_1",
        summary: "Install Otto system founder naming guidance",
        version: 1,
      },
    ],
    [
      {
        contentEncoding: "utf8_text",
        contentSha256: "abc123",
        contentText:
          "---\nname: Name Generator\ndescription: Founders naming workflow.\n---\n",
        contentType: "text/markdown",
        fileKind: "managed_entry",
        relativePath: "SKILL.md",
      },
    ],
    [
      {
        configJson: {},
        version: 12,
      },
    ],
    [
      {
        serverStatus: "ready",
        tenantId: "tenant_123",
        tenantStatus: "ready",
      },
    ],
  ]
  const insertResults = [
    [
      {
        id: "skill_123",
        skillKey: "name-and-domain-research",
      },
    ],
    [
      {
        id: "version_1",
        version: 1,
      },
    ],
    [
      {
        id: "file_skill",
        relativePath: "SKILL.md",
      },
      {
        id: "file_setup",
        relativePath: "references/setup.md",
      },
    ],
    [],
    [
      {
        version: 13,
      },
    ],
  ]

  return {
    insert: vi.fn(() => createInsertChain(insertResults.shift())),
    select: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
  }
}

function createReadyRuntimeDbMockForDelete() {
  const selectResults = [
    [
      {
        skillId: "skill_default_1",
        sourceType: "system",
      },
    ],
    [
      {
        description: "Founders naming workflow",
        displayName: "Name Generator",
        enabled: true,
        skillId: "skill_123",
        skillKey: "name-and-domain-research",
        sourceType: "system",
        status: "ready",
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      },
    ],
    [
      {
        id: "version_1",
        summary: "Install Otto system founder naming guidance",
        version: 1,
      },
    ],
    [
      {
        contentEncoding: "utf8_text",
        contentSha256: "abc123",
        contentText:
          "---\nname: Name Generator\ndescription: Founders naming workflow.\n---\n",
        contentType: "text/markdown",
        fileKind: "managed_entry",
        relativePath: "SKILL.md",
      },
    ],
    [
      {
        configJson: {
          managedSkills: {
            versions: {
              "name-and-domain-research": 1,
            },
          },
        },
        version: 20,
      },
    ],
    [
      {
        serverStatus: "ready",
        tenantId: "tenant_123",
        tenantStatus: "ready",
      },
    ],
  ]
  const insertResults = [
    [
      {
        version: 21,
      },
    ],
  ]

  return {
    delete: vi.fn(() => createDeleteChain()),
    insert: vi.fn(() => createInsertChain(insertResults.shift())),
    select: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
  }
}

function createReadyRuntimeDbMockForDefaultSkillSync() {
  const selectResults = [
    [],
    [
      {
        skillId: "skill_existing",
      },
    ],
    [
      {
        configJson: {},
        version: 12,
      },
    ],
  ]
  const insertResults = [
    [
      {
        id: "skill_otto_onboarding",
        skillKey: "otto-business-onboarding",
      },
    ],
    [
      {
        id: "version_otto_onboarding_1",
        version: 1,
      },
    ],
    [
      {
        id: "file_skill",
        relativePath: "SKILL.md",
      },
    ],
    [],
    [
      {
        version: 13,
      },
    ],
  ]

  return {
    insert: vi.fn(() => createInsertChain(insertResults.shift())),
    select: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
  }
}

function createReadyRuntimeDbMockForSeededDefaultSkillReprojection() {
  const selectResults = [
    [
      {
        skillId: "skill_otto_onboarding",
        sourceType: "system",
      },
    ],
    [
      {
        version: 1,
      },
    ],
    [],
  ]
  const insertResults = [
    [
      {
        version: 13,
      },
    ],
  ]

  return {
    insert: vi.fn(() => createInsertChain(insertResults.shift())),
    select: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
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

    expect(select).toHaveBeenCalledTimes(2)
    assert.equal(result[0]?.skillKey, "name-and-domain-research")
  })

  it("reads detail for manual-install library skills without auto-seeding them", async () => {
    const { db, select } = createDbDetailMock()
    getDb.mockReturnValue(db)

    const result = await getLatestTenantManagedSkillDetailForTenant({
      skillKey: "name-and-domain-research",
      tenantId: "tenant_123",
    })

    expect(select).toHaveBeenCalledTimes(4)
    assert.equal(result?.skillKey, "name-and-domain-research")
  })

  it("queues runtime apply when a manual library skill is installed into a ready runtime", async () => {
    getDb.mockReturnValue(createReadyRuntimeDbMockForInstall())

    const result = await createTenantSystemManagedSkillForTenant({
      files: [
        {
          contentText:
            "---\nname: Name Generator\ndescription: Founders naming workflow.\nintegrations:\n- brave\n- gandi\nskills: []\n---\n\n# Name Generator\n",
          path: "SKILL.md",
        },
        {
          contentText: "# Setup",
          path: "references/setup.md",
        },
      ],
      skillKey: "name-and-domain-research",
      summary: "Install Otto system founder naming guidance",
      tenantId: "tenant_123",
    })

    assert.deepEqual(result, {
      applyQueued: true,
      desiredStateVersion: 13,
      skillKey: "name-and-domain-research",
      version: 1,
    })
    expect(enqueueJob).toHaveBeenCalledWith({
      jobType: "apply_tenant_config",
      payload: {
        desiredStateVersion: 13,
        tenantId: "tenant_123",
      },
    })
  })

  it("queues runtime apply when a skill is removed from a ready runtime", async () => {
    getDb.mockReturnValue(createReadyRuntimeDbMockForDelete())

    const result = await deleteTenantManagedSkillForTenant({
      createdByExternalId: "user_123",
      createdByType: "user",
      expectedVersion: 1,
      skillKey: "name-and-domain-research",
      tenantId: "tenant_123",
    })

    assert.deepEqual(result, {
      applyQueued: true,
      deleted: true,
      desiredStateVersion: 21,
      skillKey: "name-and-domain-research",
    })
    expect(enqueueJob).toHaveBeenCalledWith({
      jobType: "apply_tenant_config",
      payload: {
        desiredStateVersion: 21,
        tenantId: "tenant_123",
      },
    })
  })

  it("creates missing default-installed system skills without seeding manual library skills", async () => {
    getDb.mockReturnValue(createReadyRuntimeDbMockForDefaultSkillSync())

    const result = await syncDefaultTenantManagedSkillsForTenant({
      tenantId: "tenant_123",
    })

    assert.deepEqual(result, {
      changed: true,
      createdSkillKeys: ["otto-business-onboarding"],
      desiredStateVersion: 13,
    })
    expect(enqueueJob).not.toHaveBeenCalled()
  })

  it("reprojects seeded default-installed system skills that are missing from desired state", async () => {
    getDb.mockReturnValue(createReadyRuntimeDbMockForSeededDefaultSkillReprojection())

    const result = await syncDefaultTenantManagedSkillsForTenant({
      tenantId: "tenant_123",
    })

    assert.deepEqual(result, {
      changed: false,
      createdSkillKeys: [],
      desiredStateVersion: 13,
    })
    expect(enqueueJob).not.toHaveBeenCalled()
  })
})
