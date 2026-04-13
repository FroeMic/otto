import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export interface ConversationComposerProps {
  disabled?: boolean
  onSubmit: (text: string) => Promise<void> | void
}

export function ConversationComposer({
  disabled = false,
  onSubmit,
}: ConversationComposerProps) {
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
    <div className="flex flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-card/95 p-4 shadow-sm backdrop-blur">
      <Textarea
        className="min-h-28 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
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
        placeholder="Message Otto in this workspace conversation"
        value={draft}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Press Enter to send. Shift+Enter adds a new line.
        </p>
        <Button
          disabled={disabled || draft.trim().length === 0}
          onClick={() => void submitDraft()}
        >
          <PaperPlaneTiltIcon data-icon="inline-start" />
          Send
        </Button>
      </div>
    </div>
  )
}
