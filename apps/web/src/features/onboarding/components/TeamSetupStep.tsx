"use client"

import type { WorkspaceOnboardingRunSummary } from "@otto/feature-workspace-onboarding"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

import { OnboardingOptionButton, OnboardingStepLayout } from "./OnboardingStepLayout"

const teamSizeOptions: Array<{
  description: string
  label: string
  value: WorkspaceOnboardingRunSummary["answers"]["team_size"]
}> = [
  {
    description: "You are doing the initial work yourself.",
    label: "Solo",
    value: "solo",
  },
  {
    description: "A small founding team or early core group.",
    label: "2 - 5",
    value: "2_5",
  },
  {
    description: "A growing team with more defined roles and handoffs.",
    label: "6 - 20",
    value: "6_20",
  },
  {
    description: "A larger organization with more coordination overhead.",
    label: "21+",
    value: "21_plus",
  },
]

export interface TeamSetupStepProps {
  defaultTeamSize?: WorkspaceOnboardingRunSummary["answers"]["team_size"]
  isPending?: boolean
  onBack?: () => void
  onSubmit: (
    teamSize: NonNullable<WorkspaceOnboardingRunSummary["answers"]["team_size"]>,
  ) => Promise<void> | void
}

export function TeamSetupStep({
  defaultTeamSize,
  isPending = false,
  onBack,
  onSubmit,
}: TeamSetupStepProps) {
  const [teamSize, setTeamSize] = useState(defaultTeamSize)

  useEffect(() => {
    setTeamSize(defaultTeamSize)
  }, [defaultTeamSize])

  return (
    <OnboardingStepLayout
      currentStep={3}
      description="We use this to shape the first workspace around how many people will rely on it."
      onBack={onBack}
      title="Who is going to use Otto with you?"
      totalSteps={3}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {teamSizeOptions.map((option) => (
            <OnboardingOptionButton
              description={option.description}
              isSelected={teamSize === option.value}
              key={option.value}
              label={option.label}
              onClick={() => {
                setTeamSize(option.value)
              }}
            />
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <Button
            className="rounded-full bg-foreground px-7 text-background shadow-none hover:bg-foreground/92"
            disabled={isPending || !teamSize}
            onClick={() => {
              if (!teamSize) {
                return
              }

              void onSubmit(teamSize)
            }}
            type="button"
          >
            Finish setup
          </Button>
        </div>
      </div>
    </OnboardingStepLayout>
  )
}
