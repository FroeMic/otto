import type { IntegrationCommandExecute } from "../../../framework"

export const executeGitHubTenantRuntimeGitCommand: IntegrationCommandExecute =
  async () => {
    throw new Error(
      "This GitHub command must run inside the tenant runtime so it can update the checked-out repository on disk.",
    )
  }
