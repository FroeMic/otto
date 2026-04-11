import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import {
  createFilesRouter,
  type FilesRouteDependencies,
} from "./routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): FilesRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    downloadWorkspaceFile: async () => ({
      bytes: Buffer.from("hello workspace"),
      contentType: "text/plain",
      downloadName: "readme.txt",
    }),
    getWorkspaceFilesDirectoryListing: async () => ({
      snapshot: {
        files: [
          {
            contentText: "hello workspace",
            contentType: "text/plain",
            path: "README.md",
            sizeBytes: 15,
            storageEncoding: "utf8_text",
            truncated: false,
          },
        ],
        rootExists: true,
        rootPath: "/opt/openclaw/home/workspace",
      },
      state: "ready",
    }),
  }
}

function createFilesTestApp(
  dependencies: FilesRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createFilesRouter(dependencies))

  return app
}

describe("files routes", () => {
  it("returns the workspace files snapshot payload", async () => {
    const app = createFilesTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/files",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      snapshot: {
        files: [
          {
            contentText: "hello workspace",
            contentType: "text/plain",
            path: "README.md",
            sizeBytes: 15,
            storageEncoding: "utf8_text",
            truncated: false,
          },
        ],
        rootExists: true,
        rootPath: "/opt/openclaw/home/workspace",
      },
      state: "ready",
    })
  })

  it("downloads a workspace file", async () => {
    const app = createFilesTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/files/download?path=README.md&kind=file",
    )

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), "text/plain")
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="readme.txt"',
    )
    assert.equal(await response.text(), "hello workspace")
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createFilesTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/files",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })
})
