import { describe, expect, it } from "vitest"

import { getWorkspaceOnboardingSummaryLookupSlug } from "./data"

describe("workspace onboarding save helpers", () => {
  it("uses the new workspace slug after saving workspace identity", () => {
    expect(
      getWorkspaceOnboardingSummaryLookupSlug({
        currentOrgSlug: "m-froehlich1994-test1",
        request: {
          action: "save-workspace-identity",
          workspaceName: "Advanced Datatable",
          workspaceSlug: "advanced-datatable",
        },
      }),
    ).toBe("advanced-datatable")
  })

  it("keeps the current workspace slug for later onboarding steps", () => {
    expect(
      getWorkspaceOnboardingSummaryLookupSlug({
        currentOrgSlug: "interaction42",
        request: {
          action: "save-business-type",
          businessType: "saas",
        },
      }),
    ).toBe("interaction42")
  })
})
