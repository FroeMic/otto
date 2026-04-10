import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  inviteWorkspaceMembersResponseSchema,
  inviteWorkspaceMembersSchema,
  updateWorkspaceMemberRoleSchema,
  workspaceMemberDirectorySchema,
  workspaceMemberEntryResponseSchema,
  type InviteWorkspaceMembersInput,
  type WorkspaceMemberDirectory,
  type WorkspaceMemberEntryResponse,
} from "@otto/feature-workspace-members"
import { Hono } from "hono"
import { z } from "zod"

import {
  inviteWorkspaceMembers,
  listWorkspaceMembers,
  reactivateWorkspaceMember,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  suspendWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMembersUser,
} from "./data"

const workspaceParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceMembershipParamsSchema = workspaceParamsSchema.extend({
  membershipId: z.string().min(1),
})

const workspaceInvitationParamsSchema = workspaceParamsSchema.extend({
  invitationId: z.string().min(1),
})

export interface WorkspaceMembersRouteDependencies {
  authenticateWorkspaceUser?: (request: Request) => Promise<WorkspaceMembersUser>
  inviteWorkspaceMembers: (input: {
    orgSlug: string
    payload: InviteWorkspaceMembersInput
    user: WorkspaceMembersUser
  }) => Promise<{
    invited: WorkspaceMemberDirectory["entries"]
    skipped: Array<{
      email: string
      message: string
    }>
  }>
  listWorkspaceMembers: (input: {
    orgSlug: string
    user: WorkspaceMembersUser
  }) => Promise<WorkspaceMemberDirectory>
  reactivateWorkspaceMember: (input: {
    membershipId: string
    orgSlug: string
    user: WorkspaceMembersUser
  }) => Promise<WorkspaceMemberEntryResponse>
  resendWorkspaceInvitation: (input: {
    invitationId: string
    orgSlug: string
    user: WorkspaceMembersUser
  }) => Promise<WorkspaceMemberEntryResponse>
  revokeWorkspaceInvitation: (input: {
    invitationId: string
    orgSlug: string
    user: WorkspaceMembersUser
  }) => Promise<WorkspaceMemberEntryResponse>
  suspendWorkspaceMember: (input: {
    membershipId: string
    orgSlug: string
    user: WorkspaceMembersUser
  }) => Promise<WorkspaceMemberEntryResponse>
  updateWorkspaceMemberRole: (input: {
    membershipId: string
    orgSlug: string
    roleSlug: string
    user: WorkspaceMembersUser
  }) => Promise<WorkspaceMemberEntryResponse>
}

function createDefaultWorkspaceMembersRouteDependencies(): WorkspaceMembersRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    inviteWorkspaceMembers,
    listWorkspaceMembers,
    reactivateWorkspaceMember,
    resendWorkspaceInvitation,
    revokeWorkspaceInvitation,
    suspendWorkspaceMember,
    updateWorkspaceMemberRole,
  }
}

export function createWorkspaceMembersRouter(
  dependencies: WorkspaceMembersRouteDependencies = createDefaultWorkspaceMembersRouteDependencies(),
) {
  async function authenticateUser(request: Request) {
    try {
      return {
        user: await (dependencies.authenticateWorkspaceUser
          ? dependencies.authenticateWorkspaceUser(request)
          : authenticateWorkspaceSessionRequest({ request })),
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

  return new Hono()
    .get(
      "/api/workspace/:orgSlug/members",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")
        const directory = await dependencies.listWorkspaceMembers({
          orgSlug,
          user: authResult.user,
        })

        return context.json(
          workspaceMemberDirectorySchema.parse(directory),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/members/invitations",
      zValidator("param", workspaceParamsSchema),
      zValidator("json", inviteWorkspaceMembersSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { orgSlug } = context.req.valid("param")
        const payload = context.req.valid("json")
        const result = await dependencies.inviteWorkspaceMembers({
          orgSlug,
          payload,
          user: authResult.user,
        })

        return context.json(
          inviteWorkspaceMembersResponseSchema.parse(result),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/members/:membershipId/role",
      zValidator("param", workspaceMembershipParamsSchema),
      zValidator("json", updateWorkspaceMemberRoleSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { membershipId, orgSlug } = context.req.valid("param")
        const payload = context.req.valid("json")
        const result = await dependencies.updateWorkspaceMemberRole({
          membershipId,
          orgSlug,
          roleSlug: payload.roleSlug,
          user: authResult.user,
        })

        return context.json(
          workspaceMemberEntryResponseSchema.parse(result),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/members/:membershipId/suspend",
      zValidator("param", workspaceMembershipParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { membershipId, orgSlug } = context.req.valid("param")
        const result = await dependencies.suspendWorkspaceMember({
          membershipId,
          orgSlug,
          user: authResult.user,
        })

        return context.json(
          workspaceMemberEntryResponseSchema.parse(result),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/members/:membershipId/reactivate",
      zValidator("param", workspaceMembershipParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { membershipId, orgSlug } = context.req.valid("param")
        const result = await dependencies.reactivateWorkspaceMember({
          membershipId,
          orgSlug,
          user: authResult.user,
        })

        return context.json(
          workspaceMemberEntryResponseSchema.parse(result),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/members/invitations/:invitationId/resend",
      zValidator("param", workspaceInvitationParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { invitationId, orgSlug } = context.req.valid("param")
        const result = await dependencies.resendWorkspaceInvitation({
          invitationId,
          orgSlug,
          user: authResult.user,
        })

        return context.json(
          workspaceMemberEntryResponseSchema.parse(result),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/members/invitations/:invitationId/revoke",
      zValidator("param", workspaceInvitationParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const { invitationId, orgSlug } = context.req.valid("param")
        const result = await dependencies.revokeWorkspaceInvitation({
          invitationId,
          orgSlug,
          user: authResult.user,
        })

        return context.json(
          workspaceMemberEntryResponseSchema.parse(result),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
}
