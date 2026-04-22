import assert from "node:assert/strict"

import { RuntimeAuthError } from "@otto/auth"
import { describe, it } from "vitest"

import {
  handleManagedConfigGetRequest,
  handleManagedConfigPatchRequest,
  handleManagedSkillsDeleteRequest,
  handleManagedSkillsGetRequest,
  handleManagedSkillsInstallFromLibraryRequest,
  handleManagedSkillsLibraryGetRequest,
  handleManagedSkillsPostRequest,
  handleManagedSkillsResetRequest,
  handleManagedSkillsUpdateRequest,
} from "./index"

function isNeverManagedConfigVersionConflict(_error: unknown): _error is never {
  return false
}

function isNeverManagedSkillVersionConflict(_error: unknown): _error is never {
  return false
}

describe("runtime core managed config handlers", () => {
  it("returns unauthorized when runtime auth fails", async () => {
    const response = await handleManagedConfigGetRequest({
      authenticateTenantRuntimeRequest: async () => {
        throw new RuntimeAuthError(
          "missing_runtime_bearer_token",
          "Missing runtime bearer token",
        )
      },
      getLatestTenantManagedConfig: async () => ({
        files: [],
        version: 1,
      }),
      normalizeManagedBootstrapFilePath: (filePath) => filePath,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-config",
      ),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: "Missing runtime bearer token",
    })
  })

  it("returns a managed config file when a valid filePath is requested", async () => {
    const response = await handleManagedConfigGetRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      getLatestTenantManagedConfig: async () => ({
        files: [{ path: "config/openclaw.json", contentText: "{}" }],
        version: 7,
      }),
      normalizeManagedBootstrapFilePath: (filePath) => filePath,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-config?filePath=config/openclaw.json",
      ),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      file: { path: "config/openclaw.json", contentText: "{}" },
      version: 7,
    })
  })

  it("validates managed config patch payloads", async () => {
    const response = await handleManagedConfigPatchRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      isVersionConflictError: isNeverManagedConfigVersionConflict,
      normalizeManagedBootstrapFilePath: (filePath) => filePath,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-config",
        {
          method: "PATCH",
          body: JSON.stringify({
            filePath: "config/openclaw.json",
            sharedContent: "next",
          }),
          headers: {
            "content-type": "application/json",
          },
        },
      ),
      updateTenantManagedFileSharedContentForTenant: async (payload) => payload,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      createdByExternalId: null,
      createdByType: "runtime",
      filePath: "config/openclaw.json",
      sharedContent: "next",
      summary:
        "Runtime updated shared managed config block for config/openclaw.json",
      tenantId: "tenant_123",
    })
  })
})

describe("runtime core managed skills handlers", () => {
  it("returns a managed skill detail without a separate file-read path", async () => {
    const response = await handleManagedSkillsGetRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      getLatestTenantManagedSkillDetailForTenant: async () => ({
        dependencies: {
          integrations: ["linear"],
          skills: [],
        },
        description: "Triage bug reports.",
        displayName: "bug-triage",
        enabled: true,
        files: [
          {
            contentText:
              "---\nname: bug-triage\ndescription: Triage bug reports.\n---\n",
            contentType: "text/markdown; charset=utf-8",
            editability: "editable",
            fileClass: "managed_entry",
            path: "SKILL.md",
            resettable: false,
            storageEncoding: "utf8_text",
          },
          {
            contentText: "# Setup",
            contentType: "text/markdown; charset=utf-8",
            editability: "download_only",
            fileClass: "managed_seeded",
            path: "references/setup.md",
            resettable: true,
            storageEncoding: "utf8_text",
          },
        ],
        skillId: "skill_123",
        skillKey: "bug-triage",
        sourceType: "user",
        status: "ready",
        summary: "Created bug-triage",
        updatedAt: new Date("2026-04-10T10:00:00.000Z"),
        version: 2,
      }),
      listTenantManagedSkillsForTenant: async () => [],
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills?skillKey=bug-triage",
      ),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      skill: {
        contentText:
          "---\nname: bug-triage\ndescription: Triage bug reports.\n---\n",
        dependencies: {
          integrations: ["linear"],
          skills: [],
        },
        description: "Triage bug reports.",
        displayName: "bug-triage",
        enabled: true,
        files: [
          {
            contentType: "text/markdown; charset=utf-8",
            editability: "editable",
            fileClass: "managed_entry",
            path: "SKILL.md",
            resettable: false,
            storageEncoding: "utf8_text",
          },
          {
            contentType: "text/markdown; charset=utf-8",
            editability: "download_only",
            fileClass: "managed_seeded",
            path: "references/setup.md",
            resettable: true,
            storageEncoding: "utf8_text",
          },
        ],
        skillId: "skill_123",
        skillKey: "bug-triage",
        sourceType: "user",
        status: "ready",
        summary: "Created bug-triage",
        updatedAt: "2026-04-10T10:00:00.000Z",
        version: 2,
      },
    })
  })

  it("rejects filePath query parameters on the managed skills route", async () => {
    const response = await handleManagedSkillsGetRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      getLatestTenantManagedSkillDetailForTenant: async () => null,
      listTenantManagedSkillsForTenant: async () => [],
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills?skillKey=bug-triage&filePath=SKILL.md",
      ),
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error:
        "filePath is no longer supported on the runtime-managed skills surface. Use get_managed_skill for SKILL.md content and normal file tools for local skill directories.",
    })
  })

  it("validates managed skill create payloads", async () => {
    const response = await handleManagedSkillsPostRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      createTenantManagedSkillForTenant: async (payload) => payload,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills",
        {
          body: JSON.stringify({
            contentText:
              "---\nname: bug-triage\ndescription: Triage bug reports.\n---\n",
            skillKey: "bug-triage",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      ),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      contentText:
        "---\nname: bug-triage\ndescription: Triage bug reports.\n---\n",
      createdByExternalId: null,
      createdByType: "runtime",
      skillKey: "bug-triage",
      summary: "Runtime created managed skill bug-triage",
      tenantId: "tenant_123",
    })
  })

  it("lists manual-install skill library entries for the runtime", async () => {
    const response = await handleManagedSkillsLibraryGetRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      listTenantManagedSkillLibraryEntriesForTenant: async () => [
        {
          dependencies: {
            integrations: ["gandi"],
            skills: [],
          },
          description:
            "Research names, brandability, and domains for founders.",
          displayName: "Name Generator",
          installable: true,
          installed: false,
          skillKey: "name-and-domain-research",
          summary: "Install Otto system founder naming guidance",
        },
      ],
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills/library",
      ),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      librarySkills: [
        {
          dependencies: {
            integrations: ["gandi"],
            skills: [],
          },
          description:
            "Research names, brandability, and domains for founders.",
          displayName: "Name Generator",
          installable: true,
          installed: false,
          skillKey: "name-and-domain-research",
          summary: "Install Otto system founder naming guidance",
        },
      ],
    })
  })

  it("validates managed skill library install payloads", async () => {
    const response = await handleManagedSkillsInstallFromLibraryRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      installTenantManagedSkillFromLibraryForTenant: async (payload) => payload,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills/library/install",
        {
          body: JSON.stringify({
            skillKey: "name-and-domain-research",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      ),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      createdByExternalId: null,
      createdByType: "runtime",
      skillKey: "name-and-domain-research",
      summary:
        "Runtime installed managed skill from the library: name-and-domain-research",
      tenantId: "tenant_123",
    })
  })

  it("validates patch-style managed skill updates", async () => {
    const response = await handleManagedSkillsUpdateRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      isVersionConflictError: isNeverManagedSkillVersionConflict,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills",
        {
          body: JSON.stringify({
            enabled: false,
            expectedVersion: 3,
            skillKey: "bug-triage",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        },
      ),
      updateTenantManagedSkillForTenant: async (payload) => payload,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: 3,
      patch: {
        enabled: false,
      },
      skillKey: "bug-triage",
      summary: "Runtime updated managed skill bug-triage",
      tenantId: "tenant_123",
    })
  })

  it("validates managed skill delete payloads", async () => {
    const response = await handleManagedSkillsDeleteRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      deleteTenantManagedSkillForTenant: async (payload) => payload,
      isVersionConflictError: isNeverManagedSkillVersionConflict,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills",
        {
          body: JSON.stringify({
            expectedVersion: 4,
            skillKey: "bug-triage",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "DELETE",
        },
      ),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: 4,
      skillKey: "bug-triage",
      summary: "Runtime deleted managed skill bug-triage",
      tenantId: "tenant_123",
    })
  })

  it("validates managed skill package reset payloads", async () => {
    const response = await handleManagedSkillsResetRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      isVersionConflictError: isNeverManagedSkillVersionConflict,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-skills/reset",
        {
          body: JSON.stringify({
            expectedVersion: 4,
            scope: "companion_files",
            skillKey: "bug-triage",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      ),
      resetTenantManagedSkillPackageForTenant: async (payload) => payload,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: 4,
      scope: "companion_files",
      skillKey: "bug-triage",
      summary: "Runtime reset managed skill package bug-triage",
      tenantId: "tenant_123",
    })
  })
})
