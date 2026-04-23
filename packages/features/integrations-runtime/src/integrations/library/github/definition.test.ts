import assert from "node:assert/strict"
import { describe, it } from "vitest"

import { collectCommands, getIntegrationDefinition } from "../../framework"
import { githubIntegrationDefinition } from "./definition"

describe("GitHub integration definition", () => {
  it("registers GitHub as a workspace-managed GitHub App integration", () => {
    assert.equal(githubIntegrationDefinition.key, "github")
    assert.equal(githubIntegrationDefinition.managementMode, "workspace_managed")
    assert.deepEqual(githubIntegrationDefinition.auth, {
      kind: "github_app_installation",
    })
    assert.equal(getIntegrationDefinition("github"), githubIntegrationDefinition)
  })

  it("exposes only GitHub commands with real executors", () => {
    const commands = collectCommands(
      githubIntegrationDefinition.runtimeSurface!,
    )

    assert.deepEqual(
      commands.map((command) => command.commandKey),
      ["repository.list", "repository.get"],
    )
    assert.ok(commands.every((command) => typeof command.execute === "function"))
  })
})
