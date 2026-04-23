const GITHUB_LOCAL_GIT_COMMAND_ARGUMENTS = {
  "repository.checkout": ["owner", "repo", "branch", "destinationPath"],
  "remote.fetch": ["owner", "repo", "destinationPath"],
  "remote.pull": ["owner", "repo", "branch", "rebase", "destinationPath"],
  "remote.push": ["owner", "repo", "branch", "destinationPath"],
  "branch.checkout_remote": [
    "owner",
    "repo",
    "branch",
    "localBranch",
    "destinationPath",
  ],
  "branch.publish": ["owner", "repo", "branch", "destinationPath"],
};

export const GITHUB_LOCAL_GIT_COMMANDS = new Set(
  Object.keys(GITHUB_LOCAL_GIT_COMMAND_ARGUMENTS),
);

export function validateGitHubLocalGitArguments(commandKey, argumentsObject) {
  const acceptedArguments = GITHUB_LOCAL_GIT_COMMAND_ARGUMENTS[commandKey];

  if (!acceptedArguments) {
    throw new Error(`Unsupported GitHub local git command: ${commandKey}`);
  }

  for (const key of Object.keys(argumentsObject ?? {})) {
    if (acceptedArguments.includes(key)) {
      continue;
    }

    const suggestion =
      key === "path" && acceptedArguments.includes("destinationPath")
        ? " Use destinationPath instead of path."
        : "";

    throw new Error(
      `${commandKey} does not accept the ${key} argument.${suggestion} Accepted arguments: ${acceptedArguments.join(", ")}.`,
    );
  }
}
