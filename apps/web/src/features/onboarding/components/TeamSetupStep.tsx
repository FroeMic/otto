"use client"

import type { WorkspaceOnboardingRunSummary } from "@otto/feature-workspace-onboarding"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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

function parseInviteEmails(value: string) {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export interface TeamSetupStepProps {
  defaultInviteEmails: string[]
  defaultTeamSize?: WorkspaceOnboardingRunSummary["answers"]["team_size"]
  isPending?: boolean
  onSubmit: (input: {
    inviteEmails: string[]
    teamSize: NonNullable<WorkspaceOnboardingRunSummary["answers"]["team_size"]>
  }) => Promise<void> | void
}

export function TeamSetupStep({
  defaultInviteEmails,
  defaultTeamSize,
  isPending = false,
  onSubmit,
}: TeamSetupStepProps) {
  const [teamSize, setTeamSize] = useState(defaultTeamSize)
  const [inviteDraft, setInviteDraft] = useState(defaultInviteEmails.join("\n"))

  useEffect(() => {
    setTeamSize(defaultTeamSize)
  }, [defaultTeamSize])

  useEffect(() => {
    setInviteDraft(defaultInviteEmails.join("\n"))
  }, [defaultInviteEmails])

  const parsedInviteEmails = useMemo(
    () => parseInviteEmails(inviteDraft),
    [inviteDraft],
  )

  return (
    <OnboardingStepLayout
      currentStep={3}
      description="We use this to shape the first workspace and prepare invites once your agent is ready."
      title="Who is going to use Otto with you?"
      totalSteps={3}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-[1.6rem] border border-border/70 bg-background px-6 py-6 text-left shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <Label htmlFor="invite-emails">Invite teammates</Label>
          <Textarea
            className="min-h-32 rounded-[1.4rem] border-border/70 bg-muted/25 px-4 py-3 text-sm leading-7"
            id="invite-emails"
            onChange={(event) => {
              setInviteDraft(event.target.value)
            }}
            placeholder={"one@getyourotto.com\nanother@getyourotto.com"}
            value={inviteDraft}
          />
          <p className="text-sm leading-6 text-muted-foreground">
            Add one email per line. We will keep these as invite drafts and use
            them after setup.
          </p>
        </div>

        <div className="flex justify-center pt-2">
          <Button
            className="rounded-full bg-foreground px-7 text-background shadow-none hover:bg-foreground/92"
            disabled={isPending || !teamSize}
            onClick={() => {
              if (!teamSize) {
                return
              }

              void onSubmit({
                inviteEmails: parsedInviteEmails,
                teamSize,
              })
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
