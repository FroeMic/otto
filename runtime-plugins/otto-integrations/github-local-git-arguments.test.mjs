import test from "node:test";
import assert from "node:assert/strict";

import { validateGitHubLocalGitArguments } from "./github-local-git-arguments.mjs";

test("GitHub local git commands reject unknown path arguments", () => {
  assert.throws(
    () =>
      validateGitHubLocalGitArguments("repository.checkout", {
        branch: "main",
        owner: "FroeMic",
        path: "projects/business-autopilot-ai/repositories/otto",
        repo: "otto",
      }),
    /repository\.checkout does not accept the path argument\. Use destinationPath instead of path\. Accepted arguments: owner, repo, branch, destinationPath\./,
  );
});

test("GitHub local git commands accept destinationPath", () => {
  assert.doesNotThrow(() =>
    validateGitHubLocalGitArguments("repository.checkout", {
      branch: "main",
      destinationPath: "projects/business-autopilot-ai/repositories/otto",
      owner: "FroeMic",
      repo: "otto",
    }),
  );
});
