import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  inviteWorkspaceMembersSchema,
  updateWorkspaceMemberRoleSchema,
  workspaceMemberDirectoryEntrySchema,
} from "./index"

describe("workspace members feature contracts", () => {
  it("requires valid invitation emails and a selected role", () => {
    assert.deepEqual(
      inviteWorkspaceMembersSchema.parse({
        emails: ["admin@example.com"],
        roleSlug: " admin ",
      }),
      {
        emails: ["admin@example.com"],
        roleSlug: "admin",
      },
    )

    assert.equal(
      inviteWorkspaceMembersSchema.safeParse({
        emails: ["not-an-email"],
        roleSlug: "admin",
      }).success,
      false,
    )
  })

  it("validates member directory rows and role update payloads", () => {
    assert.deepEqual(
      updateWorkspaceMemberRoleSchema.parse({
        roleSlug: " owner ",
      }),
      {
        roleSlug: "owner",
      },
    )

    assert.equal(
      workspaceMemberDirectoryEntrySchema.safeParse({
        avatarUrl: null,
        canManageRole: true,
        canReactivate: false,
        canResendInvitation: false,
        canRevokeInvitation: false,
        canSuspend: true,
        email: "admin@example.com",
        id: "member_1",
        invitationId: null,
        isCurrentUser: false,
        joinedAt: "2026-04-01T12:00:00.000Z",
        lastSeenAt: null,
        membershipId: "membership_1",
        name: "Admin User",
        role: "admin",
        roleName: "Admin",
        rowType: "member",
        searchText: "admin user admin@example.com",
        status: "active",
        subtitle: "Admin",
      }).success,
      true,
    )
  })
})
