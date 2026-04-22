import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import { RuntimePathValidationError } from "@otto/feature-runtime-core/runtime-files/download"
import {
  type RuntimeDirectoryListingResponse,
  type RuntimeDownloadKind,
  type RuntimeDownloadResult,
  runtimeDirectoryListingResponseSchema,
  runtimeDownloadKindSchema,
} from "@otto/feature-runtime-core/runtime-files/types"
import { Hono } from "hono"
import { z } from "zod"

import {
  downloadWorkspaceFile,
  getWorkspaceFilesDirectoryListing,
} from "./data"

const workspaceFilesParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceFilesDownloadQuerySchema = z.object({
  disposition: z.enum(["attachment", "inline"]).optional(),
  kind: runtimeDownloadKindSchema.optional(),
  path: z.string().trim().min(1),
})

export interface FilesRouteUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export interface FilesRouteDependencies {
  authenticateWorkspaceUser: (request: Request) => Promise<FilesRouteUser>
  downloadWorkspaceFile: (input: {
    kind: RuntimeDownloadKind
    orgSlug: string
    relativePath: string
    userExternalId: string
  }) => Promise<RuntimeDownloadResult | null>
  getWorkspaceFilesDirectoryListing: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<RuntimeDirectoryListingResponse>
}

function createDefaultFilesRouteDependencies(): FilesRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    downloadWorkspaceFile,
    getWorkspaceFilesDirectoryListing,
  }
}

export function createFilesRouter(
  dependencies: FilesRouteDependencies = createDefaultFilesRouteDependencies(),
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
      "/api/workspace/:orgSlug/files",
      zValidator("param", workspaceFilesParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        try {
          const response = await dependencies.getWorkspaceFilesDirectoryListing(
            {
              orgSlug: context.req.valid("param").orgSlug,
              userExternalId: authResult.user.id,
            },
          )

          return jsonNoStore(
            runtimeDirectoryListingResponseSchema.parse(response),
          )
        } catch (error) {
          return jsonNoStore(
            {
              code: "workspace_files_fetch_failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to load workspace files.",
            },
            500,
          )
        }
      },
    )
    .get(
      "/api/workspace/:orgSlug/files/download",
      zValidator("param", workspaceFilesParamsSchema),
      zValidator("query", workspaceFilesDownloadQuerySchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        try {
          const query = context.req.valid("query")
          const download = await dependencies.downloadWorkspaceFile({
            kind: query.kind ?? "file",
            orgSlug: context.req.valid("param").orgSlug,
            relativePath: query.path,
            userExternalId: authResult.user.id,
          })

          if (!download) {
            return jsonNoStore(
              {
                code: "runtime_unavailable",
                message: "This workspace does not have a ready tenant runtime.",
              },
              404,
            )
          }

          const disposition =
            query.disposition === "inline" ? "inline" : "attachment"

          return new Response(new Uint8Array(download.bytes), {
            headers: {
              "Cache-Control": "no-store",
              "Content-Disposition": `${disposition}; filename="${download.downloadName}"`,
              "Content-Length": String(download.bytes.byteLength),
              "Content-Type": download.contentType,
            },
            status: 200,
          })
        } catch (error) {
          return jsonNoStore(
            {
              code:
                error instanceof RuntimePathValidationError
                  ? "workspace_file_download_invalid_path"
                  : "workspace_file_download_failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to download workspace file.",
            },
            error instanceof RuntimePathValidationError ? 400 : 500,
          )
        }
      },
    )
}
