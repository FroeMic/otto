import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  getWorkspaceOnboardingHoldingState,
  hasUnconsumedStarterPrompt,
  isWorkspaceOnboardingReadyForProvisioning,
  workspaceOnboardingAnswerKeys,
} from "./index"

describe("workspace onboarding status helpers", () => {
  it("treats accepted, complete, and unstarted onboarding as ready for provisioning", () => {
    const ready = isWorkspaceOnboardingReadyForProvisioning({
      answers: {
        business_type: "saas",
        team_size: "2_5",
        workspace_name: "Acme",
        workspace_slug: "acme",
      },
      currentStepKey: "team_setup",
      initialTenantId: null,
      provisioningStartedAt: null,
      status: "collecting_answers",
      waitlistDecision: "accepted",
    })

    assert.equal(ready, true)
  })

  it("blocks provisioning when the onboarding answers are incomplete", () => {
    const ready = isWorkspaceOnboardingReadyForProvisioning({
      answers: {
        business_type: "saas",
        workspace_name: "Acme",
      },
      currentStepKey: "business_type",
      initialTenantId: null,
      provisioningStartedAt: null,
      status: "collecting_answers",
      waitlistDecision: "accepted",
    })

    assert.equal(ready, false)
  })

  it("blocks provisioning for waitlisted workspaces", () => {
    const ready = isWorkspaceOnboardingReadyForProvisioning({
      answers: {
        business_type: "saas",
        team_size: "solo",
        workspace_name: "Acme",
        workspace_slug: "acme",
      },
      currentStepKey: "team_setup",
      initialTenantId: null,
      provisioningStartedAt: null,
      status: "waitlisted",
      waitlistDecision: "waitlisted",
    })

    assert.equal(ready, false)
  })

  it("derives the holding state for waitlisted and provisioning workspaces", () => {
    assert.equal(
      getWorkspaceOnboardingHoldingState({
        isOrganizationReady: false,
        provisioningStartedAt: null,
        status: "waitlisted",
        waitlistDecision: "waitlisted",
      }),
      "waitlist",
    )

    assert.equal(
      getWorkspaceOnboardingHoldingState({
        isOrganizationReady: false,
        provisioningStartedAt: new Date("2026-04-14T10:00:00.000Z"),
        status: "provisioning",
        waitlistDecision: "accepted",
      }),
      "waiting",
    )
  })

  it("detects whether the starter prompt is still available to prefill", () => {
    assert.equal(
      hasUnconsumedStarterPrompt({
        starterPrompt: "Help me run onboarding and support.",
        starterPromptConsumedAt: null,
      }),
      true,
    )

    assert.equal(
      hasUnconsumedStarterPrompt({
        starterPrompt: "Help me run onboarding and support.",
        starterPromptConsumedAt: new Date("2026-04-14T10:00:00.000Z"),
      }),
      false,
    )
  })

  it("exports the required onboarding answer keys", () => {
    assert.deepEqual(workspaceOnboardingAnswerKeys.requiredForProvisioning, [
      "workspace_name",
      "workspace_slug",
      "business_type",
      "team_size",
    ])
  })
})
