import type { WorkspaceOnboardingHoldingState } from "@otto/feature-workspace-onboarding"
import { normalizeWorkspaceSlug } from "@otto/feature-workspace-slugs"

export function getSuggestedWorkspaceSlug(workspaceName: string) {
  return normalizeWorkspaceSlug(workspaceName)
}

export function shouldReplaceWorkspaceSlugWithSuggestion(input: {
  currentWorkspaceSlug: string
  nextSuggestedSlug: string
  previousSuggestedSlug: string
}) {
  const currentWorkspaceSlug = input.currentWorkspaceSlug.trim()
  const previousSuggestedSlug = input.previousSuggestedSlug.trim()

  return (
    currentWorkspaceSlug.length === 0 ||
    currentWorkspaceSlug === previousSuggestedSlug ||
    currentWorkspaceSlug === input.nextSuggestedSlug.trim()
  )
}

export function getOnboardingRouteAfterSave(input: {
  currentOrgSlug: string
  nextHoldingState: WorkspaceOnboardingHoldingState
  nextOrganizationSlug: string
}) {
  switch (input.nextHoldingState) {
    case "ready":
      return `/${input.nextOrganizationSlug}`
    case "waitlist":
      return `/${input.nextOrganizationSlug}/waitlist`
    case "waiting":
      return `/${input.nextOrganizationSlug}/waiting`
    default:
      return input.nextOrganizationSlug !== input.currentOrgSlug
        ? `/${input.nextOrganizationSlug}/onboarding`
        : null
  }
}
