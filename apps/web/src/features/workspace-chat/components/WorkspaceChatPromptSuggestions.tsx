import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const workspaceChatPromptSuggestions = [
  "Research the market for my next idea",
  "Summarize what changed in this workspace",
  "Turn this rough plan into next steps",
  "Set up a recurring check-in",
] as const

export interface WorkspaceChatPromptSuggestionsProps {
  className?: string
  disabled?: boolean
  onSelect?: (prompt: string) => void
}

export function WorkspaceChatPromptSuggestions({
  className,
  disabled = false,
  onSelect,
}: WorkspaceChatPromptSuggestionsProps) {
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {workspaceChatPromptSuggestions.map((prompt) => (
        <Button
          className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
          disabled={disabled || !onSelect}
          key={prompt}
          onClick={() => {
            onSelect?.(prompt)
          }}
          type="button"
          variant="outline"
        >
          {prompt}
        </Button>
      ))}
    </div>
  )
}
