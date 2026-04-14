"use client"

import type {
  WorkspaceOnboardingBusinessType,
  WorkspaceOnboardingTeamSize,
} from "@otto/feature-workspace-onboarding"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { ApiResponseError } from "@/features/workspace/api/workspace"

import {
  saveWorkspaceOnboarding,
  workspaceOnboardingQueryOptions,
} from "../api/onboarding"
import { BusinessTypeStep } from "../components/BusinessTypeStep"
import { TeamSetupStep } from "../components/TeamSetupStep"
import { getOnboardingRouteAfterSave } from "../workspace-identity"

export interface WorkspaceOnboardingPageProps {
  orgSlug: string
}

export function WorkspaceOnboardingPage({
  orgSlug,
}: WorkspaceOnboardingPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: summary } = useSuspenseQuery(workspaceOnboardingQueryOptions(orgSlug))

  const saveMutation = useMutation({
    mutationFn: async (body: Parameters<typeof saveWorkspaceOnboarding>[1]) =>
      saveWorkspaceOnboarding(orgSlug, body),
    onError: (error) => {
      toast.error(
        error instanceof ApiResponseError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to save onboarding.",
      )
    },
    onSuccess: async (nextSummary) => {
      queryClient.setQueryData(
        ["workspace-onboarding", orgSlug],
        nextSummary,
      )
      queryClient.setQueryData(
        ["workspace-onboarding", nextSummary.organizationSlug],
        nextSummary,
      )

      const nextPath = getOnboardingRouteAfterSave({
        currentOrgSlug: orgSlug,
        nextHoldingState: nextSummary.holdingState,
        nextOrganizationSlug: nextSummary.organizationSlug,
      })

      if (nextPath) {
        await navigate({
          to: nextPath,
        })
      }
    },
  })

  if (
    summary.currentStepKey === "workspace_identity" ||
    summary.currentStepKey === "business_type"
  ) {
    return (
      <BusinessTypeStep
        onSelect={async (businessType: WorkspaceOnboardingBusinessType) => {
          await saveMutation.mutateAsync({
            action: "save-business-type",
            businessType,
          })
        }}
        selectedBusinessType={summary.answers.business_type}
      />
    )
  }

  if (summary.currentStepKey === "team_setup") {
    return (
      <TeamSetupStep
        defaultTeamSize={summary.answers.team_size}
        isPending={saveMutation.isPending}
        onSubmit={async (teamSize: WorkspaceOnboardingTeamSize) => {
          await saveMutation.mutateAsync({
            action: "save-team-setup",
            teamSize,
          })
        }}
      />
    )
  }
  return null
}
