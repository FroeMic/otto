import { describe, expect, it } from "vitest"

import { getPreviousWorkspaceOnboardingStep } from "./step-navigation"

describe("workspace onboarding step navigation", () => {
  it("returns the business type step when stepping back from team setup", () => {
    expect(getPreviousWorkspaceOnboardingStep("team_setup")).toBe(
      "business_type",
    )
  })

  it("does not step back before the first step", () => {
    expect(getPreviousWorkspaceOnboardingStep("business_type")).toBeNull()
  })
})
