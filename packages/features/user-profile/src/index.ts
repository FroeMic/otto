import { z } from "zod"

export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim(),
})

export const userProfileSchema = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  name: z.string(),
})

export const connectedAccountSchema = z.object({
  avatarUrl: z.string().nullable(),
  displayName: z.string().nullable(),
  externalId: z.string(),
  fullName: z.string().nullable(),
  id: z.string(),
  provider: z.string(),
  username: z.string().nullable(),
})

export const connectedAccountsResponseSchema = z.object({
  connectedAccounts: z.array(connectedAccountSchema),
})

export const userWorkspaceMenuWorkspaceSchema = z.object({
  id: z.string(),
  isReady: z.boolean(),
  name: z.string(),
  slug: z.string(),
})

export const userWorkspacesResponseSchema = z.object({
  user: z.object({
    email: z.string().email(),
    id: z.string(),
    name: z.string(),
  }),
  workspaces: z.array(userWorkspaceMenuWorkspaceSchema),
})

export type ConnectedAccount = z.infer<typeof connectedAccountSchema>
export type UserProfile = z.infer<typeof userProfileSchema>
export type UserWorkspaceMenuWorkspace = z.infer<
  typeof userWorkspaceMenuWorkspaceSchema
>
export type UserWorkspacesResponse = z.infer<typeof userWorkspacesResponseSchema>
