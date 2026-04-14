"use client"

import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

import { workspaceOnboardingQueryOptions } from "../api/onboarding"
import { OnboardingStepLayout } from "../components/OnboardingStepLayout"

export interface WorkspaceWaitingPageProps {
  orgSlug: string
}

export function WorkspaceWaitingPage({ orgSlug }: WorkspaceWaitingPageProps) {
  const navigate = useNavigate()
  const summaryQuery = useQuery({
    ...workspaceOnboardingQueryOptions(orgSlug),
    refetchInterval: 5_000,
  })

  useEffect(() => {
    const summary = summaryQuery.data

    if (!summary) {
      return
    }

    if (summary.holdingState === "ready") {
      void navigate({
        params: {
          orgSlug,
        },
        to: "/$orgSlug",
      })
      return
    }

    if (summary.holdingState === "onboarding") {
      void navigate({
        params: {
          orgSlug,
        },
        to: "/$orgSlug/onboarding",
      })
      return
    }

    if (summary.holdingState === "waitlist") {
      void navigate({
        params: {
          orgSlug,
        },
        to: "/$orgSlug/waitlist",
      })
    }
  }, [navigate, orgSlug, summaryQuery.data])

  return (
    <OnboardingStepLayout
      currentStep={3}
      description="Your workspace exists. Otto is provisioning the first tenant server and wiring the runtime around it."
      title="We are setting up your agent"
      totalSteps={3}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-[1.6rem] border border-border/70 bg-background px-6 py-7 text-left shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="space-y-3">
          <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Setup status
          </p>
          <div className="space-y-3 text-base leading-7 text-foreground/90">
            <p>Workspace created</p>
            <p>Initial tenant server provisioning started</p>
            <p>Runtime configuration is being applied</p>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          This usually takes a few minutes. You can stay on this page while Otto
          finishes the first setup.
        </p>

        <div className="flex justify-center pt-2">
          <Button
            className="rounded-full bg-foreground px-7 text-background shadow-none hover:bg-foreground/92"
            disabled={summaryQuery.isFetching}
            onClick={() => {
              void summaryQuery.refetch()
            }}
            type="button"
          >
            {summaryQuery.isFetching ? "Refreshing..." : "Refresh status"}
          </Button>
        </div>
      </div>
    </OnboardingStepLayout>
  )
}
