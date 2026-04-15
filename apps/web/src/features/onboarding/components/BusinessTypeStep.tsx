"use client"

import type { WorkspaceOnboardingRunSummary } from "@otto/feature-workspace-onboarding"

import { OnboardingOptionButton, OnboardingStepLayout } from "./OnboardingStepLayout"

const businessTypeOptions: Array<{
  description: string
  label: string
  value: WorkspaceOnboardingRunSummary["answers"]["business_type"]
}> = [
  {
    description: "A software product with customers, subscriptions, and recurring operations.",
    label: "SaaS",
    value: "saas",
  },
  {
    description: "An AI-native product or agent experience that still needs business structure around it.",
    label: "AI product",
    value: "ai_product",
  },
  {
    description: "A repeatable service or agency model with delivery and client operations.",
    label: "Agency / service",
    value: "agency_or_service",
  },
  {
    description: "A marketplace or network business with operational complexity on both sides.",
    label: "Marketplace",
    value: "marketplace",
  },
  {
    description: "An internal workflow or operations product used to run another business function.",
    label: "Internal ops tool",
    value: "internal_tool_or_ops",
  },
  {
    description: "Something different. Otto still captures the setup context.",
    label: "Other",
    value: "other",
  },
]

export interface BusinessTypeStepProps {
  onSelect: (
    businessType: NonNullable<WorkspaceOnboardingRunSummary["answers"]["business_type"]>,
  ) => Promise<void> | void
  onBack?: () => void
  selectedBusinessType?: WorkspaceOnboardingRunSummary["answers"]["business_type"]
}

export function BusinessTypeStep({
  onSelect,
  onBack,
  selectedBusinessType,
}: BusinessTypeStepProps) {
  return (
    <OnboardingStepLayout
      currentStep={1}
      description="This helps Otto shape the first operating system around your product and business model."
      onBack={onBack}
      title="What kind of business are you building?"
      totalSteps={2}
    >
      <div className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-2 xl:grid-cols-3">
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
