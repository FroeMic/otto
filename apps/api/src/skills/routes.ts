import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  workspaceSkillCreateRequestSchema,
  workspaceSkillDeleteRequestSchema,
  workspaceSkillDeleteResponseSchema,
  workspaceSkillDetailResponseSchema,
  workspaceSkillLibraryDetailResponseSchema,
  workspaceSkillMutationResponseSchema,
  workspaceSkillResetRequestSchema,
  workspaceSkillResetResponseSchema,
  workspaceSkillsListResponseSchema,
  workspaceSkillUpdateRequestSchema,
  type WorkspaceSkillDetailResponse,
  type WorkspaceSkillDeleteResponse,
  type WorkspaceSkillLibraryDetailResponse,
  type WorkspaceSkillMutationResponse,
  type WorkspaceSkillResetResponse,
  type WorkspaceSkillsListResponse,
} from "@otto/feature-runtime-core"
import { RuntimePathValidationError } from "@otto/feature-runtime-core/runtime-files/download"
import {
  runtimeDirectoryListingResponseSchema,
  runtimeDownloadKindSchema,
  type RuntimeDirectoryListingResponse,
  type RuntimeDownloadKind,
  type RuntimeDownloadResult,
} from "@otto/feature-runtime-core/runtime-files/types"
import { Hono } from "hono"
import { z } from "zod"

import {
  createWorkspaceSkill,
  downloadWorkspaceSkillFile,
  getWorkspaceSkillDetail,
  getWorkspaceSkillLibraryDetail,
  getWorkspaceSkillFilesDirectoryListing,
  installWorkspaceLibrarySkill,
  listWorkspaceSkills,
  removeWorkspaceSkill,
  resetWorkspaceSkillPackage,
  updateWorkspaceSkill,
} from "./data"

const workspaceSkillsParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceSkillDetailParamsSchema = workspaceSkillsParamsSchema.extend({
  skillKey: z.string().min(1),
})

const workspaceSkillFilesDownloadQuerySchema = z.object({
  disposition: z.enum(["attachment", "inline"]).optional(),
  kind: runtimeDownloadKindSchema.optional(),
  path: z.string().trim().min(1),
})

export interface SkillsRouteUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export interface SkillsRouteDependencies {
  authenticateWorkspaceUser: (request: Request) => Promise<SkillsRouteUser>
  createWorkspaceSkill: (input: {
    description: string
    integrationKeys: string[]
    name: string
    orgSlug: string
    skillBody: string
    skillKey: string
    skillKeys: string[]
    userExternalId: string
  }) => Promise<WorkspaceSkillMutationResponse>
  downloadWorkspaceSkillFile: (input: {
    kind: RuntimeDownloadKind
    orgSlug: string
    relativePath: string
    skillKey: string
    userExternalId: string
  }) => Promise<RuntimeDownloadResult | null>
  getWorkspaceSkillDetail: (input: {
    orgSlug: string
    skillKey: string
    userExternalId: string
  }) => Promise<WorkspaceSkillDetailResponse | null>
  getWorkspaceSkillLibraryDetail: (input: {
    orgSlug: string
    skillKey: string
    userExternalId: string
  }) => Promise<WorkspaceSkillLibraryDetailResponse | null>
  getWorkspaceSkillFilesDirectoryListing: (input: {
    orgSlug: string
    skillKey: string
    userExternalId: string
  }) => Promise<RuntimeDirectoryListingResponse>
  installWorkspaceLibrarySkill: (input: {
    orgSlug: string
    skillKey: string
    userExternalId: string
  }) => Promise<WorkspaceSkillMutationResponse | null>
  listWorkspaceSkills: (input: {
    orgSlug: string
    userExternalId: string
  }) => Promise<WorkspaceSkillsListResponse>
  removeWorkspaceSkill: (input: {
    expectedVersion: number
    orgSlug: string
    skillKey: string
    userExternalId: string
  }) => Promise<WorkspaceSkillDeleteResponse | null>
  resetWorkspaceSkillPackage: (input: {
    expectedVersion?: number
    orgSlug: string
    scope: "companion_files"
    skillKey: string
    userExternalId: string
  }) => Promise<WorkspaceSkillResetResponse | null>
  updateWorkspaceSkill: (input: {
    description: string
    expectedVersion?: number
    integrationKeys: string[]
    name: string
    orgSlug: string
    skillBody: string
    skillKey: string
    skillKeys: string[]
    userExternalId: string
  }) => Promise<WorkspaceSkillMutationResponse | null>
}

function createDefaultSkillsRouteDependencies(): SkillsRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    createWorkspaceSkill,
    downloadWorkspaceSkillFile,
    getWorkspaceSkillDetail,
    getWorkspaceSkillLibraryDetail,
    getWorkspaceSkillFilesDirectoryListing,
    installWorkspaceLibrarySkill,
    listWorkspaceSkills,
    removeWorkspaceSkill,
    resetWorkspaceSkillPackage,
    updateWorkspaceSkill,
  }
}

export function createSkillsRouter(
  dependencies: SkillsRouteDependencies = createDefaultSkillsRouteDependencies(),
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
      "/api/workspace/:orgSlug/skills",
      zValidator("param", workspaceSkillsParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.listWorkspaceSkills({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(workspaceSkillsListResponseSchema.parse(response))
      },
    )
    .get(
      "/api/workspace/:orgSlug/skills/library/:skillKey",
      zValidator("param", workspaceSkillDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.getWorkspaceSkillLibraryDetail({
          orgSlug: context.req.valid("param").orgSlug,
          skillKey: context.req.valid("param").skillKey,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "skill_not_found",
              message: "Library skill not found",
            },
            404,
          )
        }

        return jsonNoStore(
          workspaceSkillLibraryDetailResponseSchema.parse(response),
        )
      },
    )
    .get(
      "/api/workspace/:orgSlug/skills/:skillKey",
      zValidator("param", workspaceSkillDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.getWorkspaceSkillDetail({
          orgSlug: context.req.valid("param").orgSlug,
          skillKey: context.req.valid("param").skillKey,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "skill_not_found",
              message: "Managed skill not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceSkillDetailResponseSchema.parse(response))
      },
    )
    .post(
      "/api/workspace/:orgSlug/skills",
      zValidator("json", workspaceSkillCreateRequestSchema),
      zValidator("param", workspaceSkillsParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const body = context.req.valid("json")
        const response = await dependencies.createWorkspaceSkill({
          description: body.description,
          integrationKeys: body.integrationKeys,
          name: body.name,
          orgSlug: context.req.valid("param").orgSlug,
          skillBody: body.skillBody,
          skillKey: body.skillKey,
          skillKeys: body.skillKeys,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(workspaceSkillMutationResponseSchema.parse(response))
      },
    )
    .patch(
      "/api/workspace/:orgSlug/skills/:skillKey",
      zValidator("json", workspaceSkillUpdateRequestSchema),
      zValidator("param", workspaceSkillDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const body = context.req.valid("json")
        const response = await dependencies.updateWorkspaceSkill({
          description: body.description,
          expectedVersion: body.expectedVersion,
          integrationKeys: body.integrationKeys,
          name: body.name,
          orgSlug: context.req.valid("param").orgSlug,
          skillBody: body.skillBody,
          skillKey: context.req.valid("param").skillKey,
          skillKeys: body.skillKeys,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "skill_not_found",
              message: "Managed skill not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceSkillMutationResponseSchema.parse(response))
      },
    )
    .post(
      "/api/workspace/:orgSlug/skills/library/:skillKey/install",
      zValidator("param", workspaceSkillDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.installWorkspaceLibrarySkill({
          orgSlug: context.req.valid("param").orgSlug,
          skillKey: context.req.valid("param").skillKey,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "skill_not_found",
              message: "Library skill not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceSkillMutationResponseSchema.parse(response))
      },
    )
    .post(
      "/api/workspace/:orgSlug/skills/:skillKey/reset",
      zValidator("json", workspaceSkillResetRequestSchema),
      zValidator("param", workspaceSkillDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const body = context.req.valid("json")
        const response = await dependencies.resetWorkspaceSkillPackage({
          expectedVersion: body.expectedVersion,
          orgSlug: context.req.valid("param").orgSlug,
          scope: body.scope,
          skillKey: context.req.valid("param").skillKey,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "skill_not_found",
              message: "Managed skill not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceSkillResetResponseSchema.parse(response))
      },
    )
    .delete(
      "/api/workspace/:orgSlug/skills/:skillKey",
      zValidator("json", workspaceSkillDeleteRequestSchema),
      zValidator("param", workspaceSkillDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.removeWorkspaceSkill({
          expectedVersion: context.req.valid("json").expectedVersion,
          orgSlug: context.req.valid("param").orgSlug,
          skillKey: context.req.valid("param").skillKey,
          userExternalId: authResult.user.id,
        })

        if (!response) {
          return jsonNoStore(
            {
              code: "skill_not_found",
              message: "Managed skill not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceSkillDeleteResponseSchema.parse(response))
      },
    )
    .get(
      "/api/workspace/:orgSlug/skills/:skillKey/files",
      zValidator("param", workspaceSkillDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const response = await dependencies.getWorkspaceSkillFilesDirectoryListing({
          orgSlug: context.req.valid("param").orgSlug,
          skillKey: context.req.valid("param").skillKey,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(runtimeDirectoryListingResponseSchema.parse(response))
      },
    )
    .get(
      "/api/workspace/:orgSlug/skills/:skillKey/files/download",
      zValidator("param", workspaceSkillDetailParamsSchema),
      zValidator("query", workspaceSkillFilesDownloadQuerySchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        try {
          const query = context.req.valid("query")
          const download = await dependencies.downloadWorkspaceSkillFile({
            kind: query.kind ?? "file",
            orgSlug: context.req.valid("param").orgSlug,
            relativePath: query.path,
            skillKey: context.req.valid("param").skillKey,
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
                  ? "skill_file_download_invalid_path"
                  : "skill_file_download_failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to download skill file.",
            },
            error instanceof RuntimePathValidationError ? 400 : 500,
          )
        }
      },
    )
}
