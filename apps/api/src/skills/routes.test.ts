import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import {
  createSkillsRouter,
  type SkillsRouteDependencies,
} from "./routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): SkillsRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    createWorkspaceSkill: async () => ({
      applyQueued: true,
      desiredStateVersion: 4,
      skillKey: "triage",
      version: 1,
    }),
    downloadWorkspaceSkillFile: async () => ({
      bytes: Buffer.from("skill content"),
      contentType: "text/plain",
      downloadName: "SKILL.md",
    }),
    getWorkspaceSkillDetail: async () => ({
      availableSections: ["status", "files"],
      detail: {
        dependencies: {
          integrations: ["slack"],
          skills: ["ops"],
        },
        description: "Use this skill to triage incoming requests.",
        displayName: "Triage",
        editable: true,
        files: [
          {
            contentSha256: "abc123",
            contentText: "---\nname: Triage\n---\n",
            contentType: "text/markdown",
            editability: "editable",
            fileClass: "managed_entry",
            path: "SKILL.md",
            resettable: false,
            storageEncoding: "utf8_text",
          },
          {
            contentSha256: "def456",
            contentText: "# Setup",
            contentType: "text/markdown",
            editability: "download_only",
            fileClass: "managed_seeded",
            path: "references/setup.md",
            resettable: true,
            storageEncoding: "utf8_text",
          },
        ],
        skillKey: "triage",
        sourceType: "user",
        status: "ready",
        summary: "Initial version",
        updatedAt: "2026-04-12T12:00:00.000Z",
        version: 1,
      },
      knownIntegrationKeys: ["linear", "slack"],
      knownSkillKeys: ["ops"],
      state: "ready",
    }),
    getWorkspaceSkillFilesDirectoryListing: async () => ({
      snapshot: {
        files: [
          {
            contentText: "# Triage",
            contentType: "text/markdown",
            path: "SKILL.md",
            sizeBytes: 8,
            storageEncoding: "utf8_text",
            truncated: false,
          },
        ],
        rootExists: true,
        rootPath: "/opt/openclaw/home/workspace/skills/triage",
      },
      state: "ready",
    }),
    listWorkspaceSkills: async () => ({
      knownIntegrationKeys: ["linear", "slack"],
      skills: [
        {
          description: "Use this skill to triage incoming requests.",
          displayName: "Triage",
          editable: true,
          enabled: true,
          skillKey: "triage",
          sourceType: "user",
          status: "ready",
          updatedAt: "2026-04-12T12:00:00.000Z",
        },
      ],
      state: "ready",
    }),
    resetWorkspaceSkillPackage: async () => ({
      applyQueued: true,
      desiredStateVersion: 6,
      resetScope: "companion_files",
      skillKey: "triage",
    }),
    updateWorkspaceSkill: async () => ({
      applyQueued: true,
      changed: true,
      currentVersion: 2,
      desiredStateVersion: 5,
      skillKey: "triage",
    }),
  }
}

function createSkillsTestApp(
  dependencies: SkillsRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createSkillsRouter(dependencies))

  return app
}

describe("skills routes", () => {
  it("returns the workspace skills overview payload", async () => {
    const app = createSkillsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      knownIntegrationKeys: ["linear", "slack"],
      skills: [
        {
          description: "Use this skill to triage incoming requests.",
          displayName: "Triage",
          editable: true,
          enabled: true,
          skillKey: "triage",
          sourceType: "user",
          status: "ready",
          updatedAt: "2026-04-12T12:00:00.000Z",
        },
      ],
      state: "ready",
    })
  })

  it("returns the workspace skill detail payload", async () => {
    const app = createSkillsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills/triage",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      availableSections: ["status", "files"],
      detail: {
        dependencies: {
          integrations: ["slack"],
          skills: ["ops"],
        },
        description: "Use this skill to triage incoming requests.",
        displayName: "Triage",
        editable: true,
        files: [
          {
            contentSha256: "abc123",
            contentText: "---\nname: Triage\n---\n",
            contentType: "text/markdown",
            editability: "editable",
            fileClass: "managed_entry",
            path: "SKILL.md",
            resettable: false,
            storageEncoding: "utf8_text",
          },
          {
            contentSha256: "def456",
            contentText: "# Setup",
            contentType: "text/markdown",
            editability: "download_only",
            fileClass: "managed_seeded",
            path: "references/setup.md",
            resettable: true,
            storageEncoding: "utf8_text",
          },
        ],
        skillKey: "triage",
        sourceType: "user",
        status: "ready",
        summary: "Initial version",
        updatedAt: "2026-04-12T12:00:00.000Z",
        version: 1,
      },
      knownIntegrationKeys: ["linear", "slack"],
      knownSkillKeys: ["ops"],
      state: "ready",
    })
  })

  it("creates a workspace skill", async () => {
    const app = createSkillsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills",
      {
        body: JSON.stringify({
          description: "Use this skill to triage incoming requests.",
          integrationKeys: ["slack"],
          name: "Triage",
          skillBody: "# Triage",
          skillKey: "triage",
          skillKeys: ["ops"],
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: true,
      desiredStateVersion: 4,
      skillKey: "triage",
      version: 1,
    })
  })

  it("updates a workspace skill", async () => {
    const app = createSkillsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills/triage",
      {
        body: JSON.stringify({
          description: "Use this skill to triage incoming requests quickly.",
          expectedVersion: 1,
          integrationKeys: ["linear", "slack"],
          name: "Triage",
          skillBody: "# Triage\n\nUpdated instructions.",
          skillKeys: ["ops"],
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: true,
      changed: true,
      currentVersion: 2,
      desiredStateVersion: 5,
      skillKey: "triage",
    })
  })

  it("resets a workspace skill package", async () => {
    const app = createSkillsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills/triage/reset",
      {
        body: JSON.stringify({
          expectedVersion: 2,
          scope: "companion_files",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: true,
      desiredStateVersion: 6,
      resetScope: "companion_files",
      skillKey: "triage",
    })
  })

  it("returns the workspace skill files snapshot payload", async () => {
    const app = createSkillsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills/triage/files",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      snapshot: {
        files: [
          {
            contentText: "# Triage",
            contentType: "text/markdown",
            path: "SKILL.md",
            sizeBytes: 8,
            storageEncoding: "utf8_text",
            truncated: false,
          },
        ],
        rootExists: true,
        rootPath: "/opt/openclaw/home/workspace/skills/triage",
      },
      state: "ready",
    })
  })

  it("downloads a workspace skill file", async () => {
    const app = createSkillsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills/triage/files/download?path=SKILL.md&kind=file",
    )

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), "text/plain")
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="SKILL.md"',
    )
    assert.equal(await response.text(), "skill content")
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createSkillsTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/skills",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })
})
