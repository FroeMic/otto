import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { memberships, organizations, users } from "@otto/feature-integrations-runtime/db/schema"
import type {
  InviteWorkspaceMembersInput,
  WorkspaceMemberDirectory,
  WorkspaceMemberDirectoryEntry,
  WorkspaceMemberRoleOption,
} from "@otto/feature-workspace-members"
import { WorkOS, type Invitation, type OrganizationMembership, type Role, type User } from "@workos-inc/node"
import { and, desc, eq } from "drizzle-orm"

import { getApiEnv } from "../env"
import { getOrganizationWorkspaceBySlug, syncUserFromSession } from "../workspace/data"

const ACTIVE_WORKSPACE_MEMBERSHIP_STATUS = "active"

export interface WorkspaceMembersUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

interface AuthorizedWorkspaceMembershipContext {
  currentMembershipId: string
  currentRoleSlug: string
  organizationExternalId: string
  organizationId: string
  organizationName: string
  organizationSlug: string
}

function getWorkOs() {
  const env = getApiEnv()

  return new WorkOS(env.WORKOS_API_KEY ?? "", {
    clientId: env.WORKOS_CLIENT_ID,
  })
}

function canManageWorkspaceMembers(role: string) {
  return role === "admin" || role === "owner"
}

function isWorkspaceAdminRoleSlug(roleSlug: string | null | undefined) {
  return roleSlug === "admin" || roleSlug === "owner"
}

function parseWorkOsTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const timestamp = new Date(value)

  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString()
}

function buildWorkspaceMemberSearchText(input: {
  email: string
  name: string
  role: string | null
  roleName: string | null
  status: string
  subtitle: string | null
}) {
  return [
    input.name,
    input.email,
    input.subtitle,
    input.role,
    input.roleName,
    input.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function buildWorkspaceRoleOption(role: Role): WorkspaceMemberRoleOption {
  return {
    description: role.description,
    id: role.id,
    name: role.name,
    slug: role.slug,
  }
}

function buildFallbackWorkspaceRoleOption(roleSlug: string): WorkspaceMemberRoleOption {
  return {
    description: null,
    id: roleSlug,
    name: roleSlug,
    slug: roleSlug,
  }
}

function buildWorkspaceMemberEntry(input: {
  canManageRole: boolean
  canReactivate: boolean
  canSuspend: boolean
  isCurrentUser: boolean
  membership: OrganizationMembership
  roleName: string | null
  user: User | null
}): WorkspaceMemberDirectoryEntry {
  const fullName = [input.user?.firstName, input.user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  const email =
    input.user?.email ??
    `${input.membership.userId.slice(0, 8)}@workos-user.invalid`
  const name = fullName || email
  const subtitle =
    input.user?.email && fullName
      ? input.user.email.split("@")[0] || null
      : input.membership.directoryManaged
        ? "Directory-managed member"
        : null

  return {
    avatarUrl: input.user?.profilePictureUrl ?? null,
    canManageRole: input.canManageRole,
    canReactivate: input.canReactivate,
    canResendInvitation: false,
    canRevokeInvitation: false,
    canSuspend: input.canSuspend,
    email,
    id: input.membership.id,
    invitationId: null,
    isCurrentUser: input.isCurrentUser,
    joinedAt: parseWorkOsTimestamp(input.membership.createdAt),
    lastSeenAt: parseWorkOsTimestamp(input.user?.lastSignInAt),
    membershipId: input.membership.id,
    name,
    role: input.membership.role.slug,
    roleName: input.roleName,
    rowType: "member",
    searchText: buildWorkspaceMemberSearchText({
      email,
      name,
      role: input.membership.role.slug,
      roleName: input.roleName,
      status: input.membership.status,
      subtitle,
    }),
    status: input.membership.status,
    subtitle,
  }
}

function buildWorkspaceInvitationEntry(input: {
  canResendInvitation: boolean
  canRevokeInvitation: boolean
  invitation: Invitation
  membershipId?: string | null
  role: WorkspaceMemberRoleOption | null
}): WorkspaceMemberDirectoryEntry {
  const subtitle =
    input.invitation.state === "pending"
      ? "Invitation pending"
      : input.invitation.state === "expired"
        ? "Invitation expired"
        : "Invitation revoked"

  return {
    avatarUrl: null,
    canManageRole: false,
    canReactivate: false,
    canResendInvitation: input.canResendInvitation,
    canRevokeInvitation: input.canRevokeInvitation,
    canSuspend: false,
    email: input.invitation.email,
    id: input.invitation.id,
    invitationId: input.invitation.id,
    isCurrentUser: false,
    joinedAt: parseWorkOsTimestamp(input.invitation.createdAt),
    lastSeenAt: null,
    membershipId: input.membershipId ?? null,
    name: input.invitation.email,
    role: input.role?.slug ?? null,
    roleName: input.role?.name ?? null,
    rowType: "invitation",
    searchText: buildWorkspaceMemberSearchText({
      email: input.invitation.email,
      name: input.invitation.email,
      role: input.role?.slug ?? null,
      roleName: input.role?.name ?? null,
      status: input.invitation.state,
      subtitle,
    }),
    status: input.invitation.state,
    subtitle,
  }
}

function getWorkspaceMemberSortOrder(entry: WorkspaceMemberDirectoryEntry) {
  if (entry.rowType === "member" && entry.status === "active") {
    return 0
  }

  if (entry.rowType === "member") {
    return 1
  }

  if (entry.status === "pending") {
    return 2
  }

  return 3
}

async function getAuthorizedWorkspaceMembershipContext(input: {
  orgSlug: string
  user: WorkspaceMembersUser
}): Promise<AuthorizedWorkspaceMembershipContext> {
  await syncUserFromSession(input.user)
  const organization = await getOrganizationWorkspaceBySlug({
    orgSlug: input.orgSlug,
    userExternalId: input.user.id,
  })
  const db = getDb()
  const [membership] = await db
    .select({
      externalId: memberships.externalId,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.organizationId, organization.id),
        eq(users.externalId, input.user.id),
        eq(memberships.status, ACTIVE_WORKSPACE_MEMBERSHIP_STATUS),
      ),
    )
    .orderBy(desc(memberships.updatedAt))
    .limit(1)

  if (!membership?.externalId) {
    throw new Error("You do not have access to this organization")
  }

  return {
    currentMembershipId: membership.externalId,
    currentRoleSlug: membership.role,
    organizationExternalId: organization.externalId,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
  }
}

async function listWorkspaceRoleOptions(
  organizationExternalId: string,
): Promise<WorkspaceMemberRoleOption[]> {
  const roleList = await getWorkOs().organizations.listOrganizationRoles({
    organizationId: organizationExternalId,
  })

  return roleList.data.map(buildWorkspaceRoleOption)
}

function getWorkspaceRoleOptionBySlug(
  availableRoles: WorkspaceMemberRoleOption[],
  roleSlug: string,
) {
  return availableRoles.find((role) => role.slug === roleSlug) ?? null
}

async function listWorkspaceUsersById(organizationExternalId: string) {
  const usersForOrganization = await (
    await getWorkOs().userManagement.listUsers({
      organizationId: organizationExternalId,
    })
  ).autoPagination()

  return new Map(usersForOrganization.map((user) => [user.id, user]))
}

async function hydrateWorkspaceUsersByMemberships(input: {
  membershipsForOrganization: OrganizationMembership[]
  organizationExternalId: string
}) {
  const workos = getWorkOs()
  const usersById = await listWorkspaceUsersById(input.organizationExternalId)
  const missingUserIds = Array.from(
    new Set(
      input.membershipsForOrganization
        .map((membership) => membership.userId)
        .filter((userId) => !usersById.has(userId)),
    ),
  )

  if (missingUserIds.length === 0) {
    return usersById
  }

  const missingUsers = await Promise.all(
    missingUserIds.map((userId) => workos.userManagement.getUser(userId)),
  )

  for (const user of missingUsers) {
    usersById.set(user.id, user)
  }

  return usersById
}

function getPendingMembershipsByEmail(input: {
  membershipsForOrganization: OrganizationMembership[]
  usersById: Map<string, User>
}) {
  const membershipsByEmail = new Map<string, OrganizationMembership[]>()

  for (const membership of input.membershipsForOrganization) {
    if (membership.status !== "pending") {
      continue
    }

    const email = input.usersById.get(membership.userId)?.email?.toLowerCase()

    if (!email) {
      continue
    }

    const current = membershipsByEmail.get(email) ?? []
    current.push(membership)
    membershipsByEmail.set(email, current)
  }

  return membershipsByEmail
}

function takePendingMembershipForEmail(
  membershipsByEmail: Map<string, OrganizationMembership[]>,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase()
  const matchingMemberships = membershipsByEmail.get(normalizedEmail)

  if (!matchingMemberships?.length) {
    return null
  }

  return matchingMemberships.shift() ?? null
}

async function getWorkspaceMembershipForMutation(input: {
  context: AuthorizedWorkspaceMembershipContext
  membershipId: string
}) {
  const membership = await getWorkOs().userManagement.getOrganizationMembership(
    input.membershipId,
  )

  if (membership.organizationId !== input.context.organizationExternalId) {
    throw new Error("Workspace member not found")
  }

  return membership
}

async function getWorkspaceInvitationForMutation(input: {
  context: AuthorizedWorkspaceMembershipContext
  invitationId: string
}) {
  const invitation = await getWorkOs().userManagement.getInvitation(
    input.invitationId,
  )

  if (invitation.organizationId !== input.context.organizationExternalId) {
    throw new Error("Workspace invitation not found")
  }

  return invitation
}

async function getActiveWorkspaceAdminCount(organizationExternalId: string) {
  const membershipsForOrganization = await (
    await getWorkOs().userManagement.listOrganizationMemberships({
      organizationId: organizationExternalId,
      statuses: ["active"],
    })
  ).autoPagination()

  return membershipsForOrganization.filter((membership) =>
    isWorkspaceAdminRoleSlug(membership.role.slug),
  ).length
}

async function buildWorkspaceMemberEntryFromMembership(input: {
  actingUserExternalId: string
  availableRoles: WorkspaceMemberRoleOption[]
  canManageMembers: boolean
  currentMembershipId: string
  membership: OrganizationMembership
}) {
  const user = await getWorkOs().userManagement
    .getUser(input.membership.userId)
    .catch(() => null)
  const isCurrentUser =
    input.membership.id === input.currentMembershipId ||
    input.membership.userId === input.actingUserExternalId

  return buildWorkspaceMemberEntry({
    canManageRole: input.canManageMembers && !isCurrentUser,
    canReactivate:
      input.canManageMembers &&
      !isCurrentUser &&
      input.membership.status === "inactive",
    canSuspend:
      input.canManageMembers &&
      !isCurrentUser &&
      input.membership.status === "active",
    isCurrentUser,
    membership: input.membership,
    roleName:
      getWorkspaceRoleOptionBySlug(
        input.availableRoles,
        input.membership.role.slug,
      )?.name ?? input.membership.role.slug,
    user,
  })
}

export async function listWorkspaceMembers(input: {
  orgSlug: string
  user: WorkspaceMembersUser
}): Promise<WorkspaceMemberDirectory> {
  const context = await getAuthorizedWorkspaceMembershipContext(input)
  const workos = getWorkOs()
  const [availableRoles, membershipsForOrganization, invitations] =
    await Promise.all([
      listWorkspaceRoleOptions(context.organizationExternalId),
      (
        await workos.userManagement.listOrganizationMemberships({
          organizationId: context.organizationExternalId,
        })
      ).autoPagination(),
      (
        await workos.userManagement.listInvitations({
          organizationId: context.organizationExternalId,
        })
      ).autoPagination(),
    ])
  const usersById = await hydrateWorkspaceUsersByMemberships({
    membershipsForOrganization,
    organizationExternalId: context.organizationExternalId,
  })
  const pendingMembershipsByEmail = getPendingMembershipsByEmail({
    membershipsForOrganization,
    usersById,
  })
  const canManageMembers = canManageWorkspaceMembers(context.currentRoleSlug)
  const activeAdminCount = membershipsForOrganization.filter((membership) => {
    return (
      membership.status === "active" &&
      isWorkspaceAdminRoleSlug(membership.role.slug)
    )
  }).length

  const memberEntries = membershipsForOrganization
    .filter((membership) => membership.status !== "pending")
    .map((membership) => {
      const isCurrentUser =
        membership.id === context.currentMembershipId ||
        membership.userId === input.user.id
      const isLastActiveAdmin =
        membership.status === "active" &&
        isWorkspaceAdminRoleSlug(membership.role.slug) &&
        activeAdminCount <= 1

      return buildWorkspaceMemberEntry({
        canManageRole: canManageMembers && !isCurrentUser && !isLastActiveAdmin,
        canReactivate:
          canManageMembers &&
          !isCurrentUser &&
          membership.status === "inactive",
        canSuspend:
          canManageMembers &&
          !isCurrentUser &&
          membership.status === "active" &&
          !isLastActiveAdmin,
        isCurrentUser,
        membership,
        roleName:
          getWorkspaceRoleOptionBySlug(availableRoles, membership.role.slug)
            ?.name ?? membership.role.slug,
        user: usersById.get(membership.userId) ?? null,
      })
    })

  const invitationEntries = invitations
    .filter((invitation) => invitation.state !== "accepted")
    .map((invitation) => {
      const pendingMembership = takePendingMembershipForEmail(
        pendingMembershipsByEmail,
        invitation.email,
      )
      const pendingRole = pendingMembership
        ? (getWorkspaceRoleOptionBySlug(
            availableRoles,
            pendingMembership.role.slug,
          ) ?? buildFallbackWorkspaceRoleOption(pendingMembership.role.slug))
        : null

      return buildWorkspaceInvitationEntry({
        canResendInvitation:
          canManageMembers &&
          (invitation.state === "pending" || invitation.state === "expired"),
        canRevokeInvitation:
          canManageMembers &&
          (invitation.state === "pending" || invitation.state === "expired"),
        invitation,
        membershipId: pendingMembership?.id ?? null,
        role: pendingRole,
      })
    })

  const entries = [...memberEntries, ...invitationEntries].sort((left, right) => {
    const orderDifference =
      getWorkspaceMemberSortOrder(left) - getWorkspaceMemberSortOrder(right)

    if (orderDifference !== 0) {
      return orderDifference
    }

    return left.name.localeCompare(right.name)
  })

  return {
    activeMemberCount: memberEntries.filter((entry) => entry.status === "active")
      .length,
    availableRoles,
    canManageMembers,
    entries,
    invitationCount: invitationEntries.length,
    organizationName: context.organizationName,
    organizationSlug: context.organizationSlug,
  }
}

export async function inviteWorkspaceMembers(input: {
  orgSlug: string
  payload: InviteWorkspaceMembersInput
  user: WorkspaceMembersUser
}) {
  const context = await getAuthorizedWorkspaceMembershipContext({
    orgSlug: input.orgSlug,
    user: input.user,
  })

  if (!canManageWorkspaceMembers(context.currentRoleSlug)) {
    throw new Error("Workspace admin access required")
  }

  const workos = getWorkOs()
  const normalizedEmails = Array.from(
    new Set(
      input.payload.emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  )

  if (normalizedEmails.length === 0) {
    throw new Error("At least one email is required")
  }

  const availableRoles = await listWorkspaceRoleOptions(
    context.organizationExternalId,
  )
  const selectedRole = getWorkspaceRoleOptionBySlug(
    availableRoles,
    input.payload.roleSlug,
  )

  if (!selectedRole) {
    throw new Error("Selected role is not available for this workspace")
  }

  const membershipsForOrganization = await (
    await workos.userManagement.listOrganizationMemberships({
      organizationId: context.organizationExternalId,
    })
  ).autoPagination()
  const usersById = await hydrateWorkspaceUsersByMemberships({
    membershipsForOrganization,
    organizationExternalId: context.organizationExternalId,
  })
  const pendingMembershipsByEmail = getPendingMembershipsByEmail({
    membershipsForOrganization,
    usersById,
  })

  const invited: WorkspaceMemberDirectoryEntry[] = []
  const skipped: Array<{
    email: string
    message: string
  }> = []

  for (const email of normalizedEmails) {
    const [existingUsers, existingInvitations] = await Promise.all([
      (
        await workos.userManagement.listUsers({
          email,
          organizationId: context.organizationExternalId,
        })
      ).autoPagination(),
      (
        await workos.userManagement.listInvitations({
          email,
          organizationId: context.organizationExternalId,
        })
      ).autoPagination(),
    ])

    if (existingUsers.length > 0) {
      skipped.push({
        email,
        message: "That email already has access to this workspace",
      })
      continue
    }

    const pendingMembership = takePendingMembershipForEmail(
      pendingMembershipsByEmail,
      email,
    )
    const pendingInvitation = existingInvitations.find(
      (invitation) => invitation.state === "pending",
    )
    const invitation = pendingInvitation
      ? await (async () => {
          if (
            pendingMembership &&
            pendingMembership.role.slug !== selectedRole.slug
          ) {
            await workos.userManagement.updateOrganizationMembership(
              pendingMembership.id,
              {
                roleSlug: selectedRole.slug,
              },
            )
          }

          return workos.userManagement.resendInvitation(pendingInvitation.id)
        })()
      : await workos.userManagement.sendInvitation({
          email,
          inviterUserId: input.user.id,
          organizationId: context.organizationExternalId,
          roleSlug: selectedRole.slug,
        })

    invited.push(
      buildWorkspaceInvitationEntry({
        canResendInvitation: true,
        canRevokeInvitation: true,
        invitation,
        membershipId: pendingMembership?.id ?? null,
        role: selectedRole,
      }),
    )
  }

  if (invited.length === 0) {
    throw new Error(skipped[0]?.message ?? "Workspace invite failed")
  }

  return {
    invited,
    skipped,
  }
}

export async function updateWorkspaceMemberRole(input: {
  membershipId: string
  orgSlug: string
  roleSlug: string
  user: WorkspaceMembersUser
}) {
  const context = await getAuthorizedWorkspaceMembershipContext({
    orgSlug: input.orgSlug,
    user: input.user,
  })

  if (!canManageWorkspaceMembers(context.currentRoleSlug)) {
    throw new Error("Workspace admin access required")
  }

  const availableRoles = await listWorkspaceRoleOptions(
    context.organizationExternalId,
  )

  if (!getWorkspaceRoleOptionBySlug(availableRoles, input.roleSlug)) {
    throw new Error("Selected role is not available for this workspace")
  }

  const workos = getWorkOs()
  const membership = await getWorkspaceMembershipForMutation({
    context,
    membershipId: input.membershipId,
  })

  if (
    membership.id === context.currentMembershipId ||
    membership.userId === input.user.id
  ) {
    throw new Error("You cannot change your own role from this page")
  }

  if (
    membership.status === "active" &&
    isWorkspaceAdminRoleSlug(membership.role.slug) &&
    !isWorkspaceAdminRoleSlug(input.roleSlug)
  ) {
    const activeAdminCount = await getActiveWorkspaceAdminCount(
      context.organizationExternalId,
    )

    if (activeAdminCount <= 1) {
      throw new Error("This workspace must keep at least one active admin")
    }
  }

  const updatedMembership =
    await workos.userManagement.updateOrganizationMembership(membership.id, {
      roleSlug: input.roleSlug,
    })

  return {
    entry: await buildWorkspaceMemberEntryFromMembership({
      actingUserExternalId: input.user.id,
      availableRoles,
      canManageMembers: true,
      currentMembershipId: context.currentMembershipId,
      membership: updatedMembership,
    }),
  }
}

export async function suspendWorkspaceMember(input: {
  membershipId: string
  orgSlug: string
  user: WorkspaceMembersUser
}) {
  const context = await getAuthorizedWorkspaceMembershipContext({
    orgSlug: input.orgSlug,
    user: input.user,
  })

  if (!canManageWorkspaceMembers(context.currentRoleSlug)) {
    throw new Error("Workspace admin access required")
  }

  const membership = await getWorkspaceMembershipForMutation({
    context,
    membershipId: input.membershipId,
  })

  if (
    membership.id === context.currentMembershipId ||
    membership.userId === input.user.id
  ) {
    throw new Error("You cannot suspend your own access")
  }

  if (
    membership.status === "active" &&
    isWorkspaceAdminRoleSlug(membership.role.slug)
  ) {
    const activeAdminCount = await getActiveWorkspaceAdminCount(
      context.organizationExternalId,
    )

    if (activeAdminCount <= 1) {
      throw new Error("This workspace must keep at least one active admin")
    }
  }

  const updatedMembership =
    await getWorkOs().userManagement.deactivateOrganizationMembership(
      membership.id,
    )

  return {
    entry: await buildWorkspaceMemberEntryFromMembership({
      actingUserExternalId: input.user.id,
      availableRoles: await listWorkspaceRoleOptions(
        context.organizationExternalId,
      ),
      canManageMembers: true,
      currentMembershipId: context.currentMembershipId,
      membership: updatedMembership,
    }),
  }
}

export async function reactivateWorkspaceMember(input: {
  membershipId: string
  orgSlug: string
  user: WorkspaceMembersUser
}) {
  const context = await getAuthorizedWorkspaceMembershipContext({
    orgSlug: input.orgSlug,
    user: input.user,
  })

  if (!canManageWorkspaceMembers(context.currentRoleSlug)) {
    throw new Error("Workspace admin access required")
  }

  const membership = await getWorkspaceMembershipForMutation({
    context,
    membershipId: input.membershipId,
  })

  if (
    membership.id === context.currentMembershipId ||
    membership.userId === input.user.id
  ) {
    throw new Error("You cannot reactivate your own access from this page")
  }

  const updatedMembership =
    await getWorkOs().userManagement.reactivateOrganizationMembership(
      membership.id,
    )

  return {
    entry: await buildWorkspaceMemberEntryFromMembership({
      actingUserExternalId: input.user.id,
      availableRoles: await listWorkspaceRoleOptions(
        context.organizationExternalId,
      ),
      canManageMembers: true,
      currentMembershipId: context.currentMembershipId,
      membership: updatedMembership,
    }),
  }
}

export async function resendWorkspaceInvitation(input: {
  invitationId: string
  orgSlug: string
  user: WorkspaceMembersUser
}) {
  const context = await getAuthorizedWorkspaceMembershipContext({
    orgSlug: input.orgSlug,
    user: input.user,
  })

  if (!canManageWorkspaceMembers(context.currentRoleSlug)) {
    throw new Error("Workspace admin access required")
  }

  const workos = getWorkOs()
  const invitation = await getWorkspaceInvitationForMutation({
    context,
    invitationId: input.invitationId,
  })
  const pendingMemberships = await (
    await workos.userManagement.listOrganizationMemberships({
      organizationId: context.organizationExternalId,
      statuses: ["pending"],
    })
  ).autoPagination()
  const usersById = await hydrateWorkspaceUsersByMemberships({
    membershipsForOrganization: pendingMemberships,
    organizationExternalId: context.organizationExternalId,
  })
  const pendingMembershipsByEmail = getPendingMembershipsByEmail({
    membershipsForOrganization: pendingMemberships,
    usersById,
  })
  const pendingMembership = takePendingMembershipForEmail(
    pendingMembershipsByEmail,
    invitation.email,
  )
  const availableRoles = await listWorkspaceRoleOptions(
    context.organizationExternalId,
  )
  const updatedInvitation = await workos.userManagement.resendInvitation(
    invitation.id,
  )

  return {
    entry: buildWorkspaceInvitationEntry({
      canResendInvitation: true,
      canRevokeInvitation: true,
      invitation: updatedInvitation,
      membershipId: pendingMembership?.id ?? null,
      role:
        pendingMembership &&
        (getWorkspaceRoleOptionBySlug(
          availableRoles,
          pendingMembership.role.slug,
        ) ?? buildFallbackWorkspaceRoleOption(pendingMembership.role.slug)),
    }),
  }
}

export async function revokeWorkspaceInvitation(input: {
  invitationId: string
  orgSlug: string
  user: WorkspaceMembersUser
}) {
  const context = await getAuthorizedWorkspaceMembershipContext({
    orgSlug: input.orgSlug,
    user: input.user,
  })

  if (!canManageWorkspaceMembers(context.currentRoleSlug)) {
    throw new Error("Workspace admin access required")
  }

  const workos = getWorkOs()
  const invitation = await getWorkspaceInvitationForMutation({
    context,
    invitationId: input.invitationId,
  })
  const pendingMemberships = await (
    await workos.userManagement.listOrganizationMemberships({
      organizationId: context.organizationExternalId,
      statuses: ["pending"],
    })
  ).autoPagination()
  const usersById = await hydrateWorkspaceUsersByMemberships({
    membershipsForOrganization: pendingMemberships,
    organizationExternalId: context.organizationExternalId,
  })
  const pendingMembershipsByEmail = getPendingMembershipsByEmail({
    membershipsForOrganization: pendingMemberships,
    usersById,
  })
  const pendingMembership = takePendingMembershipForEmail(
    pendingMembershipsByEmail,
    invitation.email,
  )
  const availableRoles = await listWorkspaceRoleOptions(
    context.organizationExternalId,
  )
  const updatedInvitation = await workos.userManagement.revokeInvitation(
    invitation.id,
  )

  return {
    entry: buildWorkspaceInvitationEntry({
      canResendInvitation: false,
      canRevokeInvitation: false,
      invitation: updatedInvitation,
      membershipId: pendingMembership?.id ?? null,
      role:
        pendingMembership &&
        (getWorkspaceRoleOptionBySlug(
          availableRoles,
          pendingMembership.role.slug,
        ) ?? buildFallbackWorkspaceRoleOption(pendingMembership.role.slug)),
    }),
  }
}
