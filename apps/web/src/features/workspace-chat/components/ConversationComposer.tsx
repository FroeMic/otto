import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { useLayoutEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export interface ConversationComposerProps {
  className?: string
  disabled?: boolean
  onSubmit: (text: string) => Promise<void> | void
  placeholder?: string
}

export function ConversationComposer({
  className,
  disabled = false,
  onSubmit,
  placeholder = "Message Otto in this workspace conversation",
}: ConversationComposerProps) {
  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`
  }, [draft])

  async function submitDraft() {
    const nextDraft = draft.trim()

    if (!nextDraft || disabled) {
      return
    }

    await onSubmit(nextDraft)
    setDraft("")
  }

  return (
    <div
      className={cn(
        "rounded-[2rem] border border-border/70 bg-background/96 px-5 py-4 backdrop-blur-xl",
        className,
      )}
    >
      <Textarea
        className="max-h-60 min-h-[5.5rem] resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 pr-28 text-base leading-8 shadow-none focus-visible:ring-0 md:text-[15px]"
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
        placeholder={placeholder}
        ref={textareaRef}
        value={draft}
      />

      <div className="mt-3 flex items-center justify-end gap-3">
        <Button
          className="rounded-full px-4"
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
