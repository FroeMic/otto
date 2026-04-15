import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildInitialProvisioningJobInputForWorkspaceOnboarding,
  getPostAuthRedirectPathForWorkspaceOnboarding,
} from "./data"

describe("workspace onboarding post-auth bootstrap", () => {
  it("keeps the default return path when no intake session is present", async () => {
    const redirectPath = await getPostAuthRedirectPathForWorkspaceOnboarding(
      {
        defaultReturnTo: "/pricing",
        intakeSessionId: null,
        user: {
          email: "michael@getyourotto.com",
          id: "user_123",
        },
      },
      {
        createWorkspaceForUser: async () => {
          throw new Error("not used")
        },
        createWorkspaceOnboardingRun: async () => {
          throw new Error("not used")
        },
        getDashboardOrganizations: async () => {
          throw new Error("not used")
        },
        getPublicIntakeSessionById: async () => null,
        markPublicIntakeSessionConverted: async () => {
          throw new Error("not used")
        },
        syncUserFromSession: async () => {
          throw new Error("not used")
        },
      },
    )

    assert.equal(redirectPath, "/pricing")
  })

  it("creates a first workspace onboarding run from the captured intake prompt", async () => {
    let createWorkspaceCalled = false
    let onboardingCreated = false
    let intakeMarked = false

    const redirectPath = await getPostAuthRedirectPathForWorkspaceOnboarding(
      {
        defaultReturnTo: "/?intake=session_123",
        intakeSessionId: "session_123",
        user: {
          email: "michael@getyourotto.com",
          id: "user_123",
        },
      },
      {
        createWorkspaceForUser: async ({ user, workspaceName }) => {
          createWorkspaceCalled = true
          assert.equal(user.id, "user_123")
          assert.equal(workspaceName, "Michael's Workspace")

          return {
            organizationId: "org_123",
            organizationSlug: "interaction42",
          }
        },
        createWorkspaceOnboardingRun: async ({
          organizationId,
          starterPrompt,
          userId,
        }) => {
          onboardingCreated = true
          assert.equal(organizationId, "org_123")
          assert.equal(userId, "local_user_123")
          assert.equal(starterPrompt, "Help me run onboarding and support.")
        },
        getDashboardOrganizations: async () => [],
        getPublicIntakeSessionById: async (publicIntakeSessionId) => {
          assert.equal(publicIntakeSessionId, "session_123")

          return {
            id: "session_123",
            prompt: "Help me run onboarding and support.",
          }
        },
        markPublicIntakeSessionConverted: async ({
          organizationId,
          publicIntakeSessionId,
          userId,
        }) => {
          intakeMarked = true
          assert.equal(publicIntakeSessionId, "session_123")
          assert.equal(userId, "local_user_123")
          assert.equal(organizationId, "org_123")
        },
        syncUserFromSession: async (user) => {
          assert.equal(user.email, "michael@getyourotto.com")

          return {
            id: "local_user_123",
          }
        },
      },
    )

    assert.equal(redirectPath, "/interaction42/onboarding")
    assert.equal(createWorkspaceCalled, true)
    assert.equal(onboardingCreated, true)
    assert.equal(intakeMarked, true)
  })

  it("routes existing users with an intake session into their first workspace", async () => {
    let onboardingCreated = false

    const redirectPath = await getPostAuthRedirectPathForWorkspaceOnboarding(
      {
        defaultReturnTo: "/?intake=session_123",
        intakeSessionId: "session_123",
        user: {
          email: "michael@getyourotto.com",
          id: "user_123",
        },
      },
      {
        createWorkspaceForUser: async () => {
          throw new Error("not used")
        },
        createWorkspaceOnboardingRun: async ({
          organizationId,
          starterPrompt,
          userId,
        }) => {
          onboardingCreated = true
          assert.equal(organizationId, "org_123")
          assert.equal(userId, "local_user_123")
          assert.equal(starterPrompt, "Help me run onboarding and support.")
        },
        getDashboardOrganizations: async () => [
          {
            id: "org_123",
            isReady: true,
            locale: "en-US",
            name: "Interaction42",
            slug: "interaction42",
            timeFormatPreference: "auto",
            timezone: "UTC",
          },
        ],
        getPublicIntakeSessionById: async () => ({
          id: "session_123",
          prompt: "Help me run onboarding and support.",
        }),
        markPublicIntakeSessionConverted: async ({
          organizationId,
          userId,
        }) => {
          assert.equal(userId, "local_user_123")
          assert.equal(organizationId, "org_123")
        },
        syncUserFromSession: async () => ({
          id: "local_user_123",
        }),
      },
    )

    assert.equal(redirectPath, "/interaction42")
    assert.equal(onboardingCreated, true)
  })
})

describe("workspace onboarding provisioning strategy selection", () => {
  it("builds the legacy provisioning job payload by default", () => {
    const result = buildInitialProvisioningJobInputForWorkspaceOnboarding({
      provisioningMode: "legacy_base_image",
      tenantId: "tenant_123",
    })

    assert.deepEqual(result, {
      jobType: "provision_tenant_server",
      payloadJson: {
        step: "create_server",
        tenantId: "tenant_123",
      },
      tenantServer: {
        provisioningStrategy: "legacy_base_image",
        provider: "hetzner",
        sshUsername: "openclaw",
        status: "creating",
      },
    })
  })

  it("builds the snapshot provisioning job payload when snapshot mode is enabled", () => {
    const result = buildInitialProvisioningJobInputForWorkspaceOnboarding({
      provisioningMode: "hetzner_snapshot",
      tenantId: "tenant_123",
    })

    assert.deepEqual(result, {
      jobType: "provision_tenant_server_from_snapshot",
      payloadJson: {
        step: "create_server_from_snapshot",
        tenantId: "tenant_123",
      },
      tenantServer: {
        provisioningStrategy: "hetzner_snapshot",
        provider: "hetzner",
        sshUsername: "openclaw",
        status: "creating",
      },
    })
  })
})
