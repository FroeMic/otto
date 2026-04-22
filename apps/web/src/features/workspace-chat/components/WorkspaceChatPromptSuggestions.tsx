import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const workspaceChatPromptSuggestions = [
  "Brainstorm a new business idea",
  "Review a business",
  "Work on an existing business",
  "Set up a recurring task",
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
