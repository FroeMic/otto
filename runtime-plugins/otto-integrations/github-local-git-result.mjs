export function buildGitHubCheckoutResult(input) {
  return {
    ok: true,
    branch: input.branch,
    command: "repository.checkout",
    containerPath: input.repoPath,
    hostPath: mapGitHubWorkspacePathToHostPath(input.repoPath),
    path: input.repoPath,
    repository: input.repository,
    verification: input.verification,
  };
}

function mapGitHubWorkspacePathToHostPath(repoPath) {
  const workspacePrefix = "/home/node/.openclaw/workspace/";

  if (repoPath.startsWith(workspacePrefix)) {
    return `/opt/openclaw/home/workspace/${repoPath.slice(workspacePrefix.length)}`;
  }

  return repoPath;
}
