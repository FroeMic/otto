"use client"

import type {
  WorkspaceOnboardingBusinessType,
  WorkspaceOnboardingRunSummary,
  WorkspaceOnboardingTeamSize,
} from "@otto/feature-workspace-onboarding"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { shellBootstrapQueryOptions, ApiResponseError } from "@/features/workspace/api/workspace"

import {
  saveWorkspaceOnboarding,
  workspaceOnboardingQueryOptions,
} from "../api/onboarding"
import { BusinessTypeStep } from "../components/BusinessTypeStep"
import { TeamSetupStep } from "../components/TeamSetupStep"
import { WorkspaceIdentityStep } from "../components/WorkspaceIdentityStep"

export interface WorkspaceOnboardingPageProps {
  orgSlug: string
}

function getNextPathForSummary(summary: WorkspaceOnboardingRunSummary) {
  switch (summary.holdingState) {
    case "ready":
      return `/${summary.organizationSlug}`
    case "waitlist":
      return `/${summary.organizationSlug}/waitlist`
    case "waiting":
      return `/${summary.organizationSlug}/waiting`
    case "onboarding":
    default:
      return null
  }
}

export function WorkspaceOnboardingPage({
  orgSlug,
}: WorkspaceOnboardingPageProps) {
  const navigate = useNavigate()
  const { data: shellData } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
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
      const nextPath = getNextPathForSummary(nextSummary)

      if (nextPath) {
        await navigate({
          to: nextPath,
        })
      }
    },
  })

  const defaultWorkspaceName =
    summary.answers.workspace_name?.trim() ||
    shellData.currentOrganization.name ||
    "Workspace"
  const defaultWorkspaceSlug =
    summary.answers.workspace_slug?.trim() || shellData.currentOrganization.slug

  if (summary.currentStepKey === "business_type") {
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
        defaultInviteEmails={summary.answers.invite_emails ?? []}
        defaultTeamSize={summary.answers.team_size}
        isPending={saveMutation.isPending}
        onSubmit={async (input: {
          inviteEmails: string[]
          teamSize: WorkspaceOnboardingTeamSize
        }) => {
          await saveMutation.mutateAsync({
            action: "save-team-setup",
            inviteEmails: input.inviteEmails,
            teamSize: input.teamSize,
          })
        }}
      />
    )
  }

  return (
    <WorkspaceIdentityStep
      defaultWorkspaceName={defaultWorkspaceName}
      defaultWorkspaceSlug={defaultWorkspaceSlug}
      isPending={saveMutation.isPending}
      onSubmit={async (input) => {
        await saveMutation.mutateAsync({
          action: "save-workspace-identity",
          workspaceName: input.workspaceName,
          workspaceSlug: input.workspaceSlug,
        })
      }}
    />
  )
}
