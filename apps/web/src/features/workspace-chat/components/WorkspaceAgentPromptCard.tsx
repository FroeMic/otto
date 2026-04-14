"use client"

import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"

import { ConversationComposer } from "./ConversationComposer"

export interface WorkspaceAgentPromptCardProps {
  disabled?: boolean
  orgSlug: string
  onSubmit: (input: {
    parts: ReturnType<typeof import("../composer-parts").buildWorkspaceChatComposerParts>
  }) => Promise<void> | void
  onUploadAttachment?: (file: File) => Promise<WorkspaceChatAttachment>
}

export function WorkspaceAgentPromptCard({
  disabled = false,
  orgSlug,
  onSubmit,
  onUploadAttachment,
}: WorkspaceAgentPromptCardProps) {
  return (
    <ConversationComposer
      className="border-border/65 bg-background/97"
      disabled={disabled}
      orgSlug={orgSlug}
      onSubmit={onSubmit}
      onUploadAttachment={onUploadAttachment}
      placeholder="Message Otto in this workspace"
    />
  )
}
