import assert from "node:assert/strict"
import { describe, it } from "vitest"

import type { IntegrationCommandDefinition } from "./types"
import { validateCommandArguments } from "./validation"

describe("validateCommandArguments", () => {
  it("rejects unknown arguments with accepted argument guidance", () => {
    const command: IntegrationCommandDefinition = {
      argumentsSchema: {
        additionalProperties: false,
        properties: {
          branch: { type: "string" },
          destinationPath: { type: "string" },
          owner: { type: "string" },
          repo: { type: "string" },
        },
        required: ["owner", "repo"],
        type: "object",
      },
      commandKey: "repository.checkout",
      commandPath: ["repository", "checkout"],
      description: "Check out a repository.",
      inputMode: "json",
      label: "Check out repository",
      resultMode: "json",
    }

    assert.throws(
      () =>
        validateCommandArguments(command, {
          branch: "main",
          owner: "FroeMic",
          path: "projects/app/repositories/otto",
          repo: "otto",
        }),
      /repository\.checkout does not accept the path argument\. Use destinationPath instead of path\. Accepted arguments: branch, destinationPath, owner, repo\./,
    )
  })
})
