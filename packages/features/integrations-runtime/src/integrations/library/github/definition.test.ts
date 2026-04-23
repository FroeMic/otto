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

  it("defines complete repository, branch, and pull request command groups", () => {
    const commands = collectCommands(
      githubIntegrationDefinition.runtimeSurface!,
    ).map((command) => command.commandKey)

    assert.deepEqual(commands.sort(), [
      "branch.checkout",
      "branch.compare",
      "branch.create",
      "branch.delete",
      "branch.get",
      "branch.list",
      "branch.pull",
      "branch.push",
      "issue.add_labels",
      "issue.close",
      "issue.comment",
      "issue.create",
      "issue.get",
      "issue.list_comments",
      "issue.remove_labels",
      "issue.reopen",
      "issue.search",
      "issue.update",
      "pull_request.close",
      "pull_request.comment",
      "pull_request.convert_to_draft",
      "pull_request.create",
      "pull_request.delete_comment",
      "pull_request.get",
      "pull_request.list",
      "pull_request.list_checks",
      "pull_request.list_comments",
      "pull_request.list_files",
      "pull_request.list_reviews",
      "pull_request.mark_ready_for_review",
      "pull_request.merge",
      "pull_request.reopen",
      "pull_request.request_review",
      "pull_request.search",
      "pull_request.submit_review",
      "pull_request.update",
      "pull_request.update_comment",
      "repository.checkout",
      "repository.cleanup_worktree",
      "repository.commit",
      "repository.compare",
      "repository.diff",
      "repository.fetch",
      "repository.get",
      "repository.get_file",
      "repository.list",
      "repository.list_tree",
      "repository.pull",
      "repository.search",
      "repository.status",
    ])
  })

  it("marks high-risk branch and pull request operations as write commands requiring confirmation", () => {
    const commands = new Map(
      collectCommands(githubIntegrationDefinition.runtimeSurface!).map(
        (command) => [command.commandKey, command],
      ),
    )

    for (const commandKey of [
      "repository.commit",
      "branch.push",
      "branch.delete",
      "pull_request.merge",
    ]) {
      const command = commands.get(commandKey)

      assert.ok(command, `missing ${commandKey}`)
      assert.equal(command.effect, "write")
      assert.equal(command.safety, "destructive")
      assert.match(command.description, /confirm/i)
      assert.deepEqual(
        Object.keys(command.argumentsSchema.properties ?? {}).filter((key) =>
          ["changeReason", "confirm"].includes(key),
        ).sort(),
        ["changeReason", "confirm"],
      )
    }
  })
})
