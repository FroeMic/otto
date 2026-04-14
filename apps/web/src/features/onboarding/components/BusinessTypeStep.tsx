"use client"

import type { WorkspaceOnboardingRunSummary } from "@otto/feature-workspace-onboarding"

import { OnboardingOptionButton, OnboardingStepLayout } from "./OnboardingStepLayout"

const businessTypeOptions: Array<{
  description: string
  label: string
  value: WorkspaceOnboardingRunSummary["answers"]["business_type"]
}> = [
  {
    description: "A software product with subscriptions, customers, and recurring operations.",
    label: "SaaS",
    value: "saas",
  },
  {
    description: "An AI-native product or agent experience that needs business structure around it.",
    label: "AI product",
    value: "ai_product",
  },
  {
    description: "A service or agency model with repeatable delivery and client operations.",
    label: "Agency / service",
    value: "agency_or_service",
  },
  {
    description: "A marketplace or network business with two-sided or operational complexity.",
    label: "Marketplace",
    value: "marketplace",
  },
  {
    description: "An internal ops or workflow product used to run another business function.",
    label: "Internal ops tool",
    value: "internal_tool_or_ops",
  },
  {
    description: "Something different. Otto will still capture the setup context.",
    label: "Other",
    value: "other",
  },
]

export interface BusinessTypeStepProps {
  onSelect: (
    businessType: NonNullable<WorkspaceOnboardingRunSummary["answers"]["business_type"]>,
  ) => Promise<void> | void
  selectedBusinessType?: WorkspaceOnboardingRunSummary["answers"]["business_type"]
}

export function BusinessTypeStep({
  onSelect,
  selectedBusinessType,
}: BusinessTypeStepProps) {
  return (
    <OnboardingStepLayout
      currentStep={2}
      description="This helps Otto shape the first operating system around your product and business model."
      title="What kind of business are you building?"
      totalSteps={3}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {businessTypeOptions.map((option) => (
          <OnboardingOptionButton
            description={option.description}
            isSelected={selectedBusinessType === option.value}
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
