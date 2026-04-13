"use client"

import { ConversationComposer } from "./ConversationComposer"

export interface WorkspaceAgentPromptCardProps {
  disabled?: boolean
  onSubmit: (text: string) => Promise<void> | void
}

export function WorkspaceAgentPromptCard({
  disabled = false,
  onSubmit,
}: WorkspaceAgentPromptCardProps) {
  return (
    <ConversationComposer
      className="border-border/65 bg-background/97"
      disabled={disabled}
      onSubmit={onSubmit}
      placeholder="Message Otto in this workspace"
    />
  )
}
