import assert from "node:assert/strict"

import { beforeEach, describe, expect, it, vi } from "vitest"

const getDb = vi.fn()
const listIntegrationDefinitions = vi.fn()
const getOrganizationWorkspaceBySlug = vi.fn()
const listTenantManagedSkillsForTenant = vi.fn()
const getLatestTenantManagedSkillDetailForTenant = vi.fn()
const createTenantSystemManagedSkillForTenant = vi.fn()
const getRuntimeIntegrationForTenant = vi.fn()

vi.mock("@otto/feature-integrations-runtime/db/client", () => ({
  getDb,
}))

vi.mock("@otto/feature-integrations-runtime/integrations/framework", () => ({
  listIntegrationDefinitions,
}))

vi.mock("../workspace/data", () => ({
  getOrganizationWorkspaceBySlug,
}))

vi.mock("../runtime/managed-skills-data", () => ({
  createTenantManagedSkillForTenant: vi.fn(),
  createTenantSystemManagedSkillForTenant,
  deleteTenantManagedSkillForTenant: vi.fn(),
  getLatestTenantManagedSkillDetailForTenant,
  listTenantManagedSkillsForTenant,
  resetTenantManagedSkillPackageForTenant: vi.fn(),
  updateTenantManagedSkillTextFileForTenant: vi.fn(),
}))

vi.mock("../runtime/integrations", () => ({
  getRuntimeIntegrationForTenant,
}))

const {
  getWorkspaceSkillDetail,
  getWorkspaceSkillLibraryDetail,
  installWorkspaceLibrarySkill,
  listWorkspaceSkills,
} = await import("./data")

function mockReadyWorkspace() {
  getOrganizationWorkspaceBySlug.mockResolvedValue({
    id: "org_123",
  })

  const limit = vi.fn().mockResolvedValue([
    {
      serverStatus: "ready",
      tenantId: "tenant_123",
      tenantStatus: "ready",
    },
  ])
  const orderBy = vi.fn(() => ({ limit }))
  const where = vi.fn(() => ({ orderBy }))
  const leftJoin = vi.fn(() => ({ where }))
  const from = vi.fn(() => ({ leftJoin }))
  const select = vi.fn(() => ({ from }))

  getDb.mockReturnValue({
    select,
  })
}

describe("workspace skills visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listIntegrationDefinitions.mockReturnValue([
      { key: "brave" },
      { key: "gandi" },
    ])
    mockReadyWorkspace()
  })

  it("hides internal helper system skills but shows user-facing default skills", async () => {
    listTenantManagedSkillsForTenant.mockResolvedValue([
      {
        description: "Internal helper guidance",
        displayName: "skill-creator",
        enabled: true,
        skillId: "skill_helper",
        skillKey: "skill-creator",
        sourceType: "system",
        status: "ready",
        updatedAt: new Date("2026-04-15T12:00:00.000Z"),
      },
      {
        description: "Business idea onboarding workflow",
        displayName: "Business Idea Onboarding",
        enabled: true,
        skillId: "skill_business_idea",
        skillKey: "business-idea-onboarding",
        sourceType: "system",
        status: "ready",
        updatedAt: new Date("2026-04-15T12:00:00.000Z"),
      },
      {
        description: "Founders naming workflow",
        displayName: "Name Generator",
        enabled: true,
        skillId: "skill_name",
        skillKey: "name-and-domain-research",
        sourceType: "system",
        status: "ready",
        updatedAt: new Date("2026-04-15T12:00:00.000Z"),
      },
      {
        description: "Custom workspace skill",
        displayName: "Triage",
        enabled: true,
        skillId: "skill_custom",
        skillKey: "triage",
        sourceType: "user",
        status: "ready",
        updatedAt: new Date("2026-04-15T12:00:00.000Z"),
      },
    ])

    const result = await listWorkspaceSkills({
      orgSlug: "interaction42",
      userExternalId: "user_123",
    })

    expect(result.installedSkills.map((skill) => skill.skillKey)).toEqual([
      "business-idea-onboarding",
      "name-and-domain-research",
      "triage",
    ])
    expect(result.librarySkills.map((skill) => skill.skillKey)).toEqual([
      "name-and-domain-research",
      "business-idea-onboarding",
      "business-review",
    ])
  })

  it("returns null detail for hidden helper system skills", async () => {
    getLatestTenantManagedSkillDetailForTenant.mockResolvedValue({
      description: "Internal helper guidance",
      displayName: "skill-creator",
      enabled: true,
      files: [
        {
          contentSha256: "abc123",
          contentText: "---\nname: skill-creator\n---\n",
          contentType: "text/markdown",
          editability: "download_only",
          fileClass: "managed_entry",
          path: "SKILL.md",
          resettable: false,
          storageEncoding: "utf8_text",
        },
      ],
      skillId: "skill_helper",
      skillKey: "skill-creator",
      sourceType: "system",
      status: "ready",
      summary: "Internal helper guidance",
      updatedAt: new Date("2026-04-15T12:00:00.000Z"),
      version: 1,
    })
    listTenantManagedSkillsForTenant.mockResolvedValue([])

    const result = await getWorkspaceSkillDetail({
      orgSlug: "interaction42",
      skillKey: "skill-creator",
      userExternalId: "user_123",
    })

    assert.equal(result, null)
  })

  it("returns preview content for library skill files", async () => {
    listTenantManagedSkillsForTenant.mockResolvedValue([])

    const result = await getWorkspaceSkillLibraryDetail({
      orgSlug: "interaction42",
      skillKey: "name-and-domain-research",
      userExternalId: "user_123",
    })

    expect(result?.detail?.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentText: expect.stringContaining("Brand Name Generator"),
          path: "SKILL.md",
          storageEncoding: "utf8_text",
        }),
        expect.objectContaining({
          contentText: expect.stringContaining("expandDomainCandidates"),
          path: "scripts/generate-domain-variants.mjs",
          storageEncoding: "utf8_text",
        }),
      ]),
    )
  })

  it("rejects library skill installs when required integrations are missing", async () => {
    listTenantManagedSkillsForTenant.mockResolvedValue([])
    getLatestTenantManagedSkillDetailForTenant.mockResolvedValue(null)
    getRuntimeIntegrationForTenant.mockImplementation(
      async ({ integrationKey }) =>
        integrationKey === "brave"
          ? {
              status: {
                connected: true,
                needsAttention: false,
              },
            }
          : null,
    )

    await expect(
      installWorkspaceLibrarySkill({
        orgSlug: "interaction42",
        skillKey: "name-and-domain-research",
        userExternalId: "user_123",
      }),
    ).rejects.toThrow("Install blocked. Missing required integrations: gandi.")
    expect(createTenantSystemManagedSkillForTenant).not.toHaveBeenCalled()
  })
})
