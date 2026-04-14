import type {
  WorkspaceChatAttachment,
  WorkspaceChatMessagePart,
} from "@otto/feature-workspace-chat"

import { normalizeVoiceNoteMimeType } from "./voice-note"

export type WorkspaceChatComposerAttachmentDraft =
  | {
      attachment: WorkspaceChatAttachment
      kind: "file"
    }
  | {
      attachment: WorkspaceChatAttachment
      durationMs?: number
      kind: "audio"
      previewUrl?: string
      transcript?: string
    }

export function buildWorkspaceChatComposerParts(input: {
  attachments: WorkspaceChatComposerAttachmentDraft[]
  text: string
}): WorkspaceChatMessagePart[] {
  const parts: WorkspaceChatMessagePart[] = []
  const text = input.text.trim()

  if (text) {
    parts.push({
      text,
      type: "text",
    })
  }

  for (const attachment of input.attachments) {
    if (attachment.kind === "audio") {
      parts.push({
        attachmentId: attachment.attachment.id,
        ...(typeof attachment.durationMs === "number"
          ? { durationMs: attachment.durationMs }
          : {}),
        mimeType: normalizeVoiceNoteMimeType(attachment.attachment.mimeType),
        ...(attachment.transcript?.trim()
          ? { transcript: attachment.transcript.trim() }
          : {}),
        type: "audio",
      })
      continue
    }

    parts.push({
      attachmentId: attachment.attachment.id,
      fileName: attachment.attachment.fileName,
      mimeType: attachment.attachment.mimeType,
      type: "file",
    })
  }

  return parts
}
