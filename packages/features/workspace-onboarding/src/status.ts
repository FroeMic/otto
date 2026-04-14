import {
  type WorkspaceOnboardingAnswers,
  type WorkspaceOnboardingRunStatus,
  type WorkspaceOnboardingWaitlistDecision,
  workspaceOnboardingAnswerKeys,
} from "./contracts"

export type WorkspaceOnboardingHoldingState =
  | "onboarding"
  | "waiting"
  | "waitlist"
  | "ready"

export function hasWorkspaceOnboardingRequiredAnswers(
  answers: WorkspaceOnboardingAnswers,
) {
  return workspaceOnboardingAnswerKeys.requiredForProvisioning.every((key) => {
    const value = answers[key]

    return typeof value === "string" && value.trim().length > 0
  })
}

export function isWorkspaceOnboardingReadyForProvisioning(input: {
  answers: WorkspaceOnboardingAnswers
  currentStepKey: string | null
  initialTenantId: string | null
  provisioningStartedAt: Date | null
  status: WorkspaceOnboardingRunStatus
  waitlistDecision: WorkspaceOnboardingWaitlistDecision
}) {
  if (input.waitlistDecision !== "accepted") {
    return false
  }

  if (
    input.status === "waitlisted" ||
    input.status === "failed" ||
    input.status === "ready"
  ) {
    return false
  }

  if (input.initialTenantId || input.provisioningStartedAt) {
    return false
  }

  return hasWorkspaceOnboardingRequiredAnswers(input.answers)
}

export function getWorkspaceOnboardingHoldingState(input: {
  isOrganizationReady: boolean
  provisioningStartedAt: Date | null
  status: WorkspaceOnboardingRunStatus
  waitlistDecision: WorkspaceOnboardingWaitlistDecision
}): WorkspaceOnboardingHoldingState {
  if (input.isOrganizationReady) {
    return "ready"
  }

  if (
    input.waitlistDecision === "waitlisted" ||
    input.status === "waitlisted"
  ) {
    return "waitlist"
  }

  if (input.provisioningStartedAt || input.status === "provisioning") {
    return "waiting"
  }

  return "onboarding"
}

export function hasUnconsumedStarterPrompt(input: {
  starterPrompt: string | null
  starterPromptConsumedAt: Date | null
}) {
  return Boolean(
    input.starterPrompt &&
      input.starterPrompt.trim().length > 0 &&
      input.starterPromptConsumedAt === null,
  )
}
