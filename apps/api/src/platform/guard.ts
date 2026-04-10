import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import type { WorkspaceShellUser } from "@otto/feature-workspace-core"

import {
  hasPlatformAdminRole,
  syncUserFromSession,
  type WorkspaceSummary,
} from "../workspace/data"

export interface PlatformGuardDependencies {
  authenticatePlatformUser?: (request: Request) => Promise<WorkspaceShellUser>
  getDashboardOrganizations?: (
    userExternalId: string,
  ) => Promise<WorkspaceSummary[]>
  hasPlatformAdminRole?: (userExternalId: string) => Promise<boolean>
  syncUserFromSession?: (user: WorkspaceShellUser) => Promise<unknown>
}

export async function authenticatePlatformRequest(
  dependencies: PlatformGuardDependencies,
  request: Request,
) {
  try {
    const user = await (dependencies.authenticatePlatformUser
      ? dependencies.authenticatePlatformUser(request)
      : authenticateWorkspaceSessionRequest({ request }))

    await (dependencies.syncUserFromSession
      ? dependencies.syncUserFromSession(user)
      : syncUserFromSession(user))

    const isPlatformAdmin = await (dependencies.hasPlatformAdminRole
      ? dependencies.hasPlatformAdminRole(user.id)
      : hasPlatformAdminRole(user.id))

    if (!isPlatformAdmin) {
      return {
        response: jsonNoStore(
          {
            code: "forbidden",
            message: "Platform admin access required",
          },
          403,
        ),
      } as const
    }

    return {
      user,
    } as const
  } catch (error) {
    if (isWorkspaceSessionAuthError(error)) {
      return {
        response: jsonNoStore(
          {
            code: error.code,
            message: error.message,
          },
          error.status,
        ),
      } as const
    }

    throw error
  }
}
