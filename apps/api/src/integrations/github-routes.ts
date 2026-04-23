import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import { Hono } from "hono"
import { z } from "zod"

import { beginGitHubAppInstall, completeGitHubAppSetup } from "./github-app"
import type { WorkspaceIntegrationUser } from "./routes"

const workspaceGitHubInstallParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

export interface GitHubAppRouteDependencies {
  authenticateWorkspaceUser: (
    request: Request,
  ) => Promise<WorkspaceIntegrationUser>
  beginGitHubAppInstall: typeof beginGitHubAppInstall
  completeGitHubAppSetup: typeof completeGitHubAppSetup
}

function createDefaultGitHubAppRouteDependencies(): GitHubAppRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    beginGitHubAppInstall,
    completeGitHubAppSetup,
  }
}

export function createGitHubAppRouter(
  dependencies: GitHubAppRouteDependencies = createDefaultGitHubAppRouteDependencies(),
) {
  const app = new Hono()

  async function authenticateUser(request: Request) {
    try {
      return {
        user: await dependencies.authenticateWorkspaceUser(request),
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

  return app
    .get(
      "/api/workspace/:orgSlug/integrations/github/install/start",
      zValidator("param", workspaceGitHubInstallParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const result = await dependencies.beginGitHubAppInstall({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return context.redirect(result.installUrl, 302)
      },
    )
    .get("/api/integrations/github/setup/callback", async (context) => {
      const authResult = await authenticateUser(context.req.raw)

      if ("response" in authResult) {
        return authResult.response
      }

      const installationId = context.req.query("installation_id")
      const setupAction = context.req.query("setup_action")
      const state = context.req.query("state")

      if (!installationId || !state) {
        return jsonNoStore(
          {
            code: "github_setup_invalid",
            message: "GitHub setup callback is missing required parameters.",
          },
          400,
        )
      }

      const result = await dependencies.completeGitHubAppSetup({
        installationId,
        setupAction,
        state,
        userExternalId: authResult.user.id,
      })
      const redirectUrl = `/${encodeURIComponent(result.orgSlug)}/settings/agent/integrations/github/status?github_connected=1`

      return context.redirect(redirectUrl, 302)
    })
}
