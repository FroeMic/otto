"use client"

import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"

import { ConversationComposer } from "./ConversationComposer"

export interface WorkspaceAgentPromptCardProps {
  disabled?: boolean
  initialDraft?: string
  isRunning?: boolean
  isStopping?: boolean
  orgSlug: string
  onStop?: () => Promise<void> | void
  onSubmit: (input: {
    parts: ReturnType<
      typeof import("../composer-parts").buildWorkspaceChatComposerParts
    >
  }) => Promise<void> | void
  onUploadAttachment?: (file: File) => Promise<WorkspaceChatAttachment>
}

export function WorkspaceAgentPromptCard({
  disabled = false,
  initialDraft,
  isRunning,
  isStopping,
  orgSlug,
  onStop,
  onSubmit,
  onUploadAttachment,
}: WorkspaceAgentPromptCardProps) {
  return (
    <ConversationComposer
      className="border-border/65 bg-background/97"
      disabled={disabled}
      initialDraft={initialDraft}
      isRunning={isRunning}
      isStopping={isStopping}
      orgSlug={orgSlug}
      onStop={onStop}
      onSubmit={onSubmit}
      onUploadAttachment={onUploadAttachment}
      placeholder="Message Otto in this workspace"
    />
  )
}
