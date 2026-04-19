"use client"

import type {
  WorkspaceOnboardingBusinessType,
  WorkspaceOnboardingPrimaryGoal,
  WorkspaceOnboardingStepKey,
  WorkspaceOnboardingTeamSize,
} from "@otto/feature-workspace-onboarding"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ApiResponseError } from "@/features/workspace/api/workspace"

import {
  saveWorkspaceOnboarding,
  workspaceOnboardingQueryOptions,
} from "../api/onboarding"
import { BusinessTypeStep } from "../components/BusinessTypeStep"
import { PrimaryGoalStep } from "../components/PrimaryGoalStep"
import { TeamSetupStep } from "../components/TeamSetupStep"
import { getPreviousWorkspaceOnboardingStep } from "../step-navigation"
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
  const normalizedCurrentStep: Exclude<
    WorkspaceOnboardingStepKey,
    "workspace_identity"
  > | null =
    summary.currentStepKey === "workspace_identity"
      ? "primary_goal"
      : summary.currentStepKey
  const [visibleStep, setVisibleStep] = useState(normalizedCurrentStep)

  useEffect(() => {
    setVisibleStep(normalizedCurrentStep)
  }, [normalizedCurrentStep, orgSlug])

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

  if (visibleStep === "primary_goal") {
    return (
      <PrimaryGoalStep
        onSelect={async (primaryGoal: WorkspaceOnboardingPrimaryGoal) => {
          await saveMutation.mutateAsync({
            action: "save-primary-goal",
            primaryGoal,
          })
          setVisibleStep(
            normalizedCurrentStep === "business_type"
              ? "business_type"
              : "primary_goal",
          )
        }}
        selectedPrimaryGoal={summary.answers.primary_goal}
      />
    )
  }

  if (visibleStep === "business_type") {
    return (
      <BusinessTypeStep
        onSelect={async (businessType: WorkspaceOnboardingBusinessType) => {
          await saveMutation.mutateAsync({
            action: "save-business-type",
            businessType,
          })
          setVisibleStep(normalizedCurrentStep === "team_setup" ? "team_setup" : "business_type")
        }}
        selectedBusinessType={summary.answers.business_type}
      />
    )
  }

  if (visibleStep === "team_setup") {
    return (
      <TeamSetupStep
        defaultTeamSize={summary.answers.team_size}
        isPending={saveMutation.isPending}
        onBack={() => {
          const previousStep = getPreviousWorkspaceOnboardingStep("team_setup")

          if (previousStep) {
            setVisibleStep(previousStep)
          }
        }}
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
