import assert from "node:assert/strict"
import { exec } from "node:child_process"
import { mkdtemp, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { describe, it } from "vitest"

import {
  downloadRuntimePath,
  RuntimePathValidationError,
} from "./runtime-files/download"
import { getRuntimeDirectorySnapshot } from "./runtime-files/snapshot"

const execAsync = promisify(exec)

describe("runtime files snapshot", () => {
  it("normalizes and sorts runtime directory snapshots", async () => {
    const snapshot = await getRuntimeDirectorySnapshot({
      execute: async () => ({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({
          files: [
            {
              contentText: "zeta",
              contentType: "text/plain",
              path: "zeta.txt",
              sizeBytes: 4,
              storageEncoding: "utf8_text",
              truncated: false,
            },
            {
              contentText: "alpha",
              contentType: "text/plain",
              path: "alpha.txt",
              sizeBytes: 5,
              storageEncoding: "utf8_text",
              truncated: false,
            },
            {
              contentType: "text/plain",
              path: "",
              sizeBytes: 1,
              storageEncoding: "utf8_text",
              truncated: false,
            },
          ],
          rootExists: true,
        }),
      }),
      failureMessage: "Failed to read files.",
      rootPath: "/opt/openclaw/home/workspace",
    })

    assert.deepEqual(snapshot, {
      files: [
        {
          contentText: "alpha",
          contentType: "text/plain",
          path: "alpha.txt",
          sizeBytes: 5,
          storageEncoding: "utf8_text",
          truncated: false,
        },
        {
          contentText: "zeta",
          contentType: "text/plain",
          path: "zeta.txt",
          sizeBytes: 4,
          storageEncoding: "utf8_text",
          truncated: false,
        },
      ],
      rootExists: true,
      rootPath: "/opt/openclaw/home/workspace",
    })
  })

  it("skips broken symlinks instead of failing the whole snapshot", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-files-"))
    await writeFile(path.join(root, "README.md"), "hello")
    await symlink(
      path.join(root, "missing-target"),
      path.join(root, "broken-link"),
    )

    const snapshot = await getRuntimeDirectorySnapshot({
      execute: async (command) => {
        try {
          const result = await execAsync(command)

          return {
            exitCode: 0,
            stderr: result.stderr,
            stdout: result.stdout,
          }
        } catch (error) {
          const typedError = error as {
            code?: number
            stderr?: string
            stdout?: string
          }

          return {
            exitCode: typedError.code ?? 1,
            stderr: typedError.stderr ?? "",
            stdout: typedError.stdout ?? "",
          }
        }
      },
      failureMessage: "Failed to read files.",
      rootPath: root,
    })

    assert.deepEqual(
      snapshot.files.map((file) => file.path),
      ["README.md"],
    )
  })
})

describe("runtime files download", () => {
  it("decodes downloaded runtime file payloads", async () => {
    const result = await downloadRuntimePath({
      execute: async () => ({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({
          base64: Buffer.from("hello world").toString("base64"),
          contentType: "text/plain",
        }),
      }),
      kind: "file",
      relativePath: "_docs/readme.txt",
      rootPath: "/opt/openclaw/home/workspace",
    })

    assert.equal(result.contentType, "text/plain")
    assert.equal(result.downloadName, "readme.txt")
    assert.equal(result.bytes.toString("utf8"), "hello world")
  })

  it("rejects relative paths that escape the runtime root", async () => {
    await assert.rejects(
      () =>
        downloadRuntimePath({
          execute: async () => ({
            exitCode: 0,
            stderr: "",
            stdout: JSON.stringify({
              base64: Buffer.from("ignored").toString("base64"),
              contentType: "text/plain",
            }),
          }),
          kind: "file",
          relativePath: "../secrets.txt",
          rootPath: "/opt/openclaw/home/workspace",
        }),
      RuntimePathValidationError,
    )
  })
})
