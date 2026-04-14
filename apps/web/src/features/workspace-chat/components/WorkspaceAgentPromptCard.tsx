"use client"

import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"

import { ConversationComposer } from "./ConversationComposer"

export interface WorkspaceAgentPromptCardProps {
  disabled?: boolean
  initialDraft?: string
  orgSlug: string
  onSubmit: (input: {
    parts: ReturnType<typeof import("../composer-parts").buildWorkspaceChatComposerParts>
  }) => Promise<void> | void
  onUploadAttachment?: (file: File) => Promise<WorkspaceChatAttachment>
}

export function WorkspaceAgentPromptCard({
  disabled = false,
  initialDraft,
  orgSlug,
  onSubmit,
  onUploadAttachment,
}: WorkspaceAgentPromptCardProps) {
  return (
    <ConversationComposer
      className="border-border/65 bg-background/97"
      disabled={disabled}
      initialDraft={initialDraft}
      orgSlug={orgSlug}
      onSubmit={onSubmit}
      onUploadAttachment={onUploadAttachment}
      placeholder="Message Otto in this workspace"
    />
  )
}
