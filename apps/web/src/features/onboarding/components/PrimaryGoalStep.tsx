"use client"

import type { WorkspaceOnboardingRunSummary } from "@otto/feature-workspace-onboarding"

import {
  OnboardingOptionButton,
  OnboardingStepLayout,
} from "./OnboardingStepLayout"

const primaryGoalOptions: Array<{
  description: string
  label: string
  value: WorkspaceOnboardingRunSummary["answers"]["primary_goal"]
}> = [
  {
    description:
      "Turn an early idea into a clearer offer, audience, and first action plan.",
    label: "Start a new business",
    value: "start_new_business",
  },
  {
    description:
      "Research, compare, and narrow down which direction is worth pursuing.",
    label: "Compare business ideas",
    value: "compare_business_ideas",
  },
  {
    description:
      "Save time by handing off recurring workflows and operational tasks.",
    label: "Automate repetitive work",
    value: "automate_repetitive_work",
  },
  {
    description:
      "Find opportunities across sales, marketing, operations, and execution.",
    label: "Improve an existing company",
    value: "improve_existing_company",
  },
]

export interface PrimaryGoalStepProps {
  onSelect: (
    primaryGoal: NonNullable<
      WorkspaceOnboardingRunSummary["answers"]["primary_goal"]
    >,
  ) => Promise<void> | void
  selectedPrimaryGoal?: WorkspaceOnboardingRunSummary["answers"]["primary_goal"]
}

export function PrimaryGoalStep({
  onSelect,
  selectedPrimaryGoal,
}: PrimaryGoalStepProps) {
  return (
    <OnboardingStepLayout
      currentStep={1}
      description="Pick the starting point that best matches what you need right now."
      title="How can Otto help you first?"
      totalSteps={3}
    >
      <div className="mx-auto grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {primaryGoalOptions.map((option) => (
          <OnboardingOptionButton
            description={option.description}
            isSelected={selectedPrimaryGoal === option.value}
            key={option.value}
            label={option.label}
            onClick={() => {
              if (!option.value) {
                return
              }

              void onSelect(option.value)
            }}
          />
        ))}
      </div>
    </OnboardingStepLayout>
  )
}
