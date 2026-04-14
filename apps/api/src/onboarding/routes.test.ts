import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"
import type { WorkspaceOnboardingRunSummary } from "../../../../packages/features/workspace-onboarding/src/index"

import { createWorkspaceOnboardingRouter } from "./routes"

const user = {
  email: "michael@getyourotto.com",
  id: "user_123",
}

describe("workspace onboarding routes", () => {
  it("returns the current onboarding summary", async () => {
    const app = new Hono().route(
      "/",
      createWorkspaceOnboardingRouter({
        authenticateWorkspaceUser: async () => user,
        consumeWorkspaceOnboardingStarterPrompt: async () => undefined,
        getWorkspaceOnboardingRunSummary: async ({ orgSlug, userExternalId }) => {
          assert.equal(orgSlug, "interaction42")
          assert.equal(userExternalId, "user_123")

          return {
            answers: {},
            currentStepKey: "workspace_identity",
            holdingState: "onboarding",
            initialProvisioningJobId: null,
            initialTenantId: null,
            isOrganizationReady: false,
            organizationId: "0a3a2b48-0a53-4c18-8d33-0d599ca6766a",
            organizationSlug: "interaction42",
            provisioningStartedAt: null,
            starterPrompt: "Help me run onboarding and support.",
            starterPromptConsumedAt: null,
            status: "collecting_answers",
            waitlistDecision: "accepted",
            waitlistReason: null,
          }
        },
        saveWorkspaceOnboardingRun: async () => {
          throw new Error("not used")
        },
        syncUserFromSession: async () => undefined,
      }),
    )

    const response = await app.request(
      "http://api.local/api/workspace/interaction42/onboarding",
    )
    const payload = (await response.json()) as WorkspaceOnboardingRunSummary

    assert.equal(response.status, 200)
    assert.equal(payload.organizationSlug, "interaction42")
  })

  it("saves a step and returns the updated summary", async () => {
    const app = new Hono().route(
      "/",
      createWorkspaceOnboardingRouter({
        authenticateWorkspaceUser: async () => user,
        consumeWorkspaceOnboardingStarterPrompt: async () => undefined,
        getWorkspaceOnboardingRunSummary: async () => {
          throw new Error("not used")
        },
        saveWorkspaceOnboardingRun: async ({
          body,
          orgSlug,
          userExternalId,
        }) => {
          assert.equal(orgSlug, "interaction42")
          assert.equal(userExternalId, "user_123")
          assert.deepEqual(body, {
            action: "save-business-type",
            businessType: "saas",
          })

          return {
            answers: {
              business_type: "saas",
            },
            currentStepKey: "team_setup",
            holdingState: "onboarding",
            initialProvisioningJobId: null,
            initialTenantId: null,
            isOrganizationReady: false,
            organizationId: "0a3a2b48-0a53-4c18-8d33-0d599ca6766a",
            organizationSlug: "interaction42",
            provisioningStartedAt: null,
            starterPrompt: "Help me run onboarding and support.",
            starterPromptConsumedAt: null,
            status: "collecting_answers",
            waitlistDecision: "accepted",
            waitlistReason: null,
          }
        },
        syncUserFromSession: async () => undefined,
      }),
    )

    const response = await app.request(
      "http://api.local/api/workspace/interaction42/onboarding",
      {
        body: JSON.stringify({
          action: "save-business-type",
          businessType: "saas",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )
    const payload = (await response.json()) as WorkspaceOnboardingRunSummary

    assert.equal(response.status, 200)
    assert.equal(payload.currentStepKey, "team_setup")
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = new Hono().route(
      "/",
      createWorkspaceOnboardingRouter({
        authenticateWorkspaceUser: async () => {
          throw new WorkspaceSessionAuthError(
            "missing_workspace_session",
            "Missing workspace session",
          )
        },
        consumeWorkspaceOnboardingStarterPrompt: async () => undefined,
        getWorkspaceOnboardingRunSummary: async () => {
          throw new Error("not used")
        },
        saveWorkspaceOnboardingRun: async () => {
          throw new Error("not used")
        },
        syncUserFromSession: async () => undefined,
      }),
    )

    const response = await app.request(
      "http://api.local/api/workspace/interaction42/onboarding",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })

  it("consumes the starter prompt", async () => {
    let consumed = false
    const app = new Hono().route(
      "/",
      createWorkspaceOnboardingRouter({
        authenticateWorkspaceUser: async () => user,
        consumeWorkspaceOnboardingStarterPrompt: async ({
          orgSlug,
          userExternalId,
        }) => {
          assert.equal(orgSlug, "interaction42")
          assert.equal(userExternalId, "user_123")
          consumed = true
        },
        getWorkspaceOnboardingRunSummary: async () => {
          throw new Error("not used")
        },
        saveWorkspaceOnboardingRun: async () => {
          throw new Error("not used")
        },
        syncUserFromSession: async () => undefined,
      }),
    )

    const response = await app.request(
      "http://api.local/api/workspace/interaction42/onboarding/starter-prompt/consume",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.equal(consumed, true)
    assert.deepEqual(await response.json(), {
      ok: true,
    })
  })
})
