import { describe, expect, it } from "vitest"

import {
  getOnboardingRouteAfterSave,
  getSuggestedWorkspaceSlug,
  shouldReplaceWorkspaceSlugWithSuggestion,
} from "./workspace-identity"

describe("workspace onboarding identity helpers", () => {
  it("normalizes a suggested slug from the workspace title", () => {
    expect(getSuggestedWorkspaceSlug("Advanced Datatable")).toBe(
      "advanced-datatable",
    )
  })

  it("replaces the slug while the user is still on the auto-suggested value", () => {
    expect(
      shouldReplaceWorkspaceSlugWithSuggestion({
        currentWorkspaceSlug: "m-froehlich1994-test1",
        nextSuggestedSlug: "advanced-datatable",
        previousSuggestedSlug: "m-froehlich1994-test1",
      }),
    ).toBe(true)
  })

  it("stops replacing the slug after the user edits it manually", () => {
    expect(
      shouldReplaceWorkspaceSlugWithSuggestion({
        currentWorkspaceSlug: "custom-company-slug",
        nextSuggestedSlug: "advanced-datatable",
        previousSuggestedSlug: "m-froehlich1994-test1",
      }),
    ).toBe(false)
  })

  it("moves onboarding to the new workspace slug after rename", () => {
    expect(
      getOnboardingRouteAfterSave({
        currentOrgSlug: "m-froehlich1994-test1",
        nextOrganizationSlug: "advanced-datatable",
        nextHoldingState: "onboarding",
      }),
    ).toBe("/advanced-datatable/onboarding")
  })
})
