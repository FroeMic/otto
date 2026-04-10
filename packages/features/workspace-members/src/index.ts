import { z } from "zod"

export const workspaceMemberRoleOptionSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  slug: z.string(),
})

export const workspaceMemberDirectoryEntrySchema = z.object({
  avatarUrl: z.string().nullable(),
  canManageRole: z.boolean(),
  canReactivate: z.boolean(),
  canResendInvitation: z.boolean(),
  canRevokeInvitation: z.boolean(),
  canSuspend: z.boolean(),
  email: z.string(),
  id: z.string(),
  invitationId: z.string().nullable(),
  isCurrentUser: z.boolean(),
  joinedAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  membershipId: z.string().nullable(),
  name: z.string(),
  role: z.string().nullable(),
  roleName: z.string().nullable(),
  rowType: z.enum(["invitation", "member"]),
  searchText: z.string(),
  status: z.string(),
  subtitle: z.string().nullable(),
})

export const workspaceMemberDirectorySchema = z.object({
  activeMemberCount: z.number(),
  availableRoles: z.array(workspaceMemberRoleOptionSchema),
  canManageMembers: z.boolean(),
  entries: z.array(workspaceMemberDirectoryEntrySchema),
  invitationCount: z.number(),
  organizationName: z.string(),
  organizationSlug: z.string(),
})

export const inviteWorkspaceMembersSchema = z.object({
  emails: z.array(z.string().email()).min(1, "At least one email is required"),
  roleSlug: z.string().trim().min(1, "Role is required"),
})

export const inviteWorkspaceMembersResponseSchema = z.object({
  invited: z.array(workspaceMemberDirectoryEntrySchema),
  skipped: z.array(
    z.object({
      email: z.string().email(),
      message: z.string(),
    }),
  ),
})

export const updateWorkspaceMemberRoleSchema = z.object({
  roleSlug: z.string().trim().min(1, "Role is required"),
})

export const workspaceMemberEntryResponseSchema = z.object({
  entry: workspaceMemberDirectoryEntrySchema,
})

export type InviteWorkspaceMembersInput = z.infer<
  typeof inviteWorkspaceMembersSchema
>
export type InviteWorkspaceMembersResponse = z.infer<
  typeof inviteWorkspaceMembersResponseSchema
>
export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof updateWorkspaceMemberRoleSchema
>
export type WorkspaceMemberDirectory = z.infer<
  typeof workspaceMemberDirectorySchema
>
export type WorkspaceMemberDirectoryEntry = z.infer<
  typeof workspaceMemberDirectoryEntrySchema
>
export type WorkspaceMemberEntryResponse = z.infer<
  typeof workspaceMemberEntryResponseSchema
>
export type WorkspaceMemberRoleOption = z.infer<
  typeof workspaceMemberRoleOptionSchema
>
