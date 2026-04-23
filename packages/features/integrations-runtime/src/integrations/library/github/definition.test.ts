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
      [
        "repository.list",
        "repository.get",
        "repository.search",
        "branch.list_remote",
        "branch.get_remote",
        "branch.delete_remote",
        "pull_request.list",
        "pull_request.get",
        "pull_request.list_files",
        "pull_request.list_comments",
        "pull_request.list_reviews",
        "pull_request.list_checks",
        "pull_request.create",
        "pull_request.update",
        "pull_request.comment",
        "pull_request.update_comment",
        "pull_request.delete_comment",
        "pull_request.close",
        "pull_request.reopen",
        "pull_request.mark_ready_for_review",
        "pull_request.convert_to_draft",
        "pull_request.request_review",
        "pull_request.submit_review",
        "pull_request.merge",
      ],
    )
    assert.ok(commands.every((command) => typeof command.execute === "function"))
  })
})
