"use client"

import { ArrowUpIcon, SparkleIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export interface WorkspaceAgentPromptCardProps {
  disabled?: boolean
  onSubmit: (text: string) => Promise<void> | void
}

export function WorkspaceAgentPromptCard({
  disabled = false,
  onSubmit,
}: WorkspaceAgentPromptCardProps) {
  const [draft, setDraft] = useState("")

  async function submitDraft() {
    const nextDraft = draft.trim()

    if (!nextDraft || disabled) {
      return
    }

    await onSubmit(nextDraft)
    setDraft("")
  }

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-card/95 p-5 shadow-sm backdrop-blur">
      <Textarea
        className="min-h-28 resize-none border-0 bg-transparent px-0 py-0 text-lg shadow-none focus-visible:ring-0"
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            void submitDraft()
          }
        }}
        placeholder="Ask Otto..."
        value={draft}
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SparkleIcon className="size-4" />
          <span>Agent</span>
        </div>
        <Button
          size="icon-sm"
          className="rounded-full"
          disabled={disabled || draft.trim().length === 0}
          onClick={() => void submitDraft()}
        >
          <ArrowUpIcon />
        </Button>
      </div>
    </div>
  )
}
