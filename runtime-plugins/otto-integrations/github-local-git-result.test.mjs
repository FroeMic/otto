import test from "node:test";
import assert from "node:assert/strict";

import { buildGitHubCheckoutResult } from "./github-local-git-result.mjs";

test("repository checkout results include host/container paths and verification", () => {
  const result = buildGitHubCheckoutResult({
    branch: "main",
    repository: "FroeMic/otto",
    repoPath: "/home/node/.openclaw/workspace/projects/business-autopilot-ai/repositories/otto",
    verification: {
      insideWorkTree: true,
      verified: true,
    },
  });

  assert.deepEqual(result, {
    ok: true,
    branch: "main",
    command: "repository.checkout",
    containerPath:
      "/home/node/.openclaw/workspace/projects/business-autopilot-ai/repositories/otto",
    hostPath:
      "/opt/openclaw/home/workspace/projects/business-autopilot-ai/repositories/otto",
    path: "/home/node/.openclaw/workspace/projects/business-autopilot-ai/repositories/otto",
    repository: "FroeMic/otto",
    verification: {
      insideWorkTree: true,
      verified: true,
    },
  });
});
