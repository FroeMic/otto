import type { WorkspaceOnboardingStepKey } from "@otto/feature-workspace-onboarding"

export function getPreviousWorkspaceOnboardingStep(
  stepKey: WorkspaceOnboardingStepKey,
): Exclude<WorkspaceOnboardingStepKey, "workspace_identity"> | null {
  if (stepKey === "business_type") {
    return "primary_goal"
  }

  if (stepKey === "team_setup") {
    return "business_type"
  }

  return null
}
