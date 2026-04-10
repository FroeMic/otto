import { jsonNoStore } from "@otto/auth"

import { shellBootstrapSchema, type WorkspaceSummary } from "./schemas"

export type WorkspaceShellUser = {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

type WorkspaceBootstrapFailureStage =
  | "sync_user_from_session"
  | "load_dashboard_organizations"
  | "load_current_workspace"

type WorkspaceBootstrapFailure = {
  error: unknown
  stage: WorkspaceBootstrapFailureStage
}

type WorkspaceBootstrapFailureSummary = {
  message: string
  stage: WorkspaceBootstrapFailureStage
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}

function summarizeBootstrapFailures(
  failures: WorkspaceBootstrapFailure[],
): WorkspaceBootstrapFailureSummary[] {
  return failures.map((failure) => ({
    message: getErrorMessage(failure.error),
    stage: failure.stage,
  }))
}

function getPrimaryBootstrapFailure(
  failures: WorkspaceBootstrapFailure[],
): WorkspaceBootstrapFailure | null {
  for (let index = failures.length - 1; index >= 0; index -= 1) {
    const failure = failures[index]

    if (failure?.stage === "load_current_workspace") {
      return failure
    }
  }

  return failures[0] ?? null
}

function buildBootstrapFailureResponse(failures: WorkspaceBootstrapFailure[]) {
  const primaryFailure = getPrimaryBootstrapFailure(failures)
  const summarizedFailures = summarizeBootstrapFailures(failures)

  if (!primaryFailure) {
    return {
      code: "bootstrap_failed",
      message: "Failed to load workspace.",
    }
  }

  switch (primaryFailure.stage) {
    case "load_current_workspace":
      return {
        code: "workspace_lookup_failed",
        failureStage: primaryFailure.stage,
        failures: summarizedFailures,
        message: `Failed to load the requested workspace: ${getErrorMessage(primaryFailure.error)}`,
      }
    case "load_dashboard_organizations":
      return {
        code: "workspace_list_failed",
        failureStage: primaryFailure.stage,
        failures: summarizedFailures,
        message: `Failed to load workspace access: ${getErrorMessage(primaryFailure.error)}`,
      }
    case "sync_user_from_session":
      return {
        code: "workspace_session_sync_failed",
        failureStage: primaryFailure.stage,
        failures: summarizedFailures,
        message: `Failed to refresh the workspace session: ${getErrorMessage(primaryFailure.error)}`,
      }
    default:
      return {
        code: "bootstrap_failed",
        message: "Failed to load workspace.",
      }
  }
}

export async function handleWorkspaceBootstrapRequest<
  TUser extends WorkspaceShellUser,
>(input: {
  getCurrentWorkspace?: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceSummary | null>
  getDashboardOrganizations: (
    userExternalId: string,
  ) => Promise<WorkspaceSummary[]>
  hasPlatformAdminRole: (userExternalId: string) => Promise<boolean>
  onBootstrapFailure?: (payload: {
    failures: WorkspaceBootstrapFailureSummary[]
    orgSlug: string
    userId: string
  }) => void
  orgSlug: string
  syncUserFromSession: (user: TUser) => Promise<unknown>
  user: TUser
}) {
  const userName =
    [input.user.firstName, input.user.lastName].filter(Boolean).join(" ") ||
    input.user.email

  let organizations: WorkspaceSummary[] = []
  let isPlatformAdmin = false
  const bootstrapFailures: WorkspaceBootstrapFailure[] = []

  try {
    await input.syncUserFromSession(input.user)
  } catch (error) {
    console.error("[workspace-bootstrap] sync_user_from_session", error)
    bootstrapFailures.push({
      error,
      stage: "sync_user_from_session",
    })
  }

  const [organizationsResult, isPlatformAdminResult] = await Promise.allSettled(
    [
      input.getDashboardOrganizations(input.user.id),
      input.hasPlatformAdminRole(input.user.id),
    ],
  )

  if (organizationsResult.status === "fulfilled") {
    organizations = organizationsResult.value
  } else {
    console.error(
      "[workspace-bootstrap] load_dashboard_organizations",
      organizationsResult.reason,
    )
    bootstrapFailures.push({
      error: organizationsResult.reason,
      stage: "load_dashboard_organizations",
    })
  }

  if (isPlatformAdminResult.status === "fulfilled") {
    isPlatformAdmin = isPlatformAdminResult.value
  }

  let currentOrganization =
    organizations.find((organization) => organization.slug === input.orgSlug) ??
    null

  if (!currentOrganization && input.getCurrentWorkspace) {
    try {
      currentOrganization = await input.getCurrentWorkspace({
        orgSlug: input.orgSlug,
        userExternalId: input.user.id,
      })
    } catch (error) {
      console.error("[workspace-bootstrap] load_current_workspace", error)
      bootstrapFailures.push({
        error,
        stage: "load_current_workspace",
      })
    }
  }

  if (!currentOrganization) {
    if (bootstrapFailures.length > 0) {
      input.onBootstrapFailure?.({
        failures: summarizeBootstrapFailures(bootstrapFailures),
        orgSlug: input.orgSlug,
        userId: input.user.id,
      })

      return jsonNoStore(buildBootstrapFailureResponse(bootstrapFailures), 400)
    }

    return jsonNoStore(
      {
        code: "organization_not_found",
        message: "Organization not found.",
      },
      404,
    )
  }

  if (
    !organizations.some((organization) => organization.slug === input.orgSlug)
  ) {
    organizations = [currentOrganization, ...organizations]
  }

  return jsonNoStore(
    shellBootstrapSchema.parse({
      currentOrganization,
      organizations,
      user: {
        email: input.user.email,
        id: input.user.id,
        isPlatformAdmin,
        name: userName,
      },
    }),
  )
}
