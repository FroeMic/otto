"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { OnboardingStepLayout } from "./OnboardingStepLayout"

export interface WorkspaceIdentityStepProps {
  defaultWorkspaceName: string
  defaultWorkspaceSlug: string
  isPending?: boolean
  onSubmit: (input: {
    workspaceName: string
    workspaceSlug: string
  }) => Promise<void> | void
}

export function WorkspaceIdentityStep({
  defaultWorkspaceName,
  defaultWorkspaceSlug,
  isPending = false,
  onSubmit,
}: WorkspaceIdentityStepProps) {
  const [workspaceName, setWorkspaceName] = useState(defaultWorkspaceName)
  const [workspaceSlug, setWorkspaceSlug] = useState(defaultWorkspaceSlug)

  useEffect(() => {
    setWorkspaceName(defaultWorkspaceName)
  }, [defaultWorkspaceName])

  useEffect(() => {
    setWorkspaceSlug(defaultWorkspaceSlug)
  }, [defaultWorkspaceSlug])

  return (
    <OnboardingStepLayout
      currentStep={1}
      description="We create your workspace automatically. Confirm the name and URL before Otto starts the first setup."
      title="Set up your workspace"
      totalSteps={3}
    >
      <form
        className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-[1.6rem] border border-border/70 bg-background px-6 py-7 text-left shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
        onSubmit={(event) => {
          event.preventDefault()

          void onSubmit({
            workspaceName: workspaceName.trim(),
            workspaceSlug: workspaceSlug.trim(),
          })
        }}
      >
        <div className="space-y-3">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            onChange={(event) => {
              setWorkspaceName(event.target.value)
            }}
            placeholder="Acme"
            value={workspaceName}
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="workspace-slug">Workspace URL</Label>
          <div className="flex items-center gap-3 rounded-[1.4rem] border border-border/70 bg-muted/25 px-4 py-2">
            <span className="shrink-0 text-sm text-muted-foreground">
              getyourotto.com/
            </span>
            <Input
              className="h-10 rounded-none border-0 bg-transparent px-0"
              id="workspace-slug"
              onChange={(event) => {
                setWorkspaceSlug(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, ""),
                )
              }}
              placeholder="acme"
              value={workspaceSlug}
            />
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <Button
            className="rounded-full bg-foreground px-7 text-background shadow-none hover:bg-foreground/92"
            disabled={
              isPending ||
              workspaceName.trim().length === 0 ||
              workspaceSlug.trim().length === 0
            }
            type="submit"
          >
            Next
          </Button>
        </div>
      </form>
    </OnboardingStepLayout>
  )
}
