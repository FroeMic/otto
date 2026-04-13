import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { fetchWorkspaceChatAttachment } from "./control-plane-client.js";

const ATTACHMENT_STAGING_ROOT = path.join(
  os.homedir(),
  ".openclaw",
  "workspace-chat-attachments",
);

export async function prepareWorkspaceChatInboundParts(input, dependencies = {}) {
  const fetchAttachment =
    dependencies.fetchAttachment ?? fetchWorkspaceChatAttachment;
  const stagingRoot = dependencies.stagingRoot ?? ATTACHMENT_STAGING_ROOT;
  const textSegments = [];
  const attachmentLines = [];
  const mediaAttachments = [];
  const transcripts = [];

  for (const part of input.parts) {
    if (part.type === "text") {
      const text = part.text.trim();

      if (text) {
        textSegments.push(text);
      }
      continue;
    }

    const attachment = await fetchAttachment(part.attachmentId);
    const localPath = await stageWorkspaceChatAttachmentFile({
      attachmentId: attachment.attachmentId,
      bytes: attachment.bytes,
      conversationId: input.conversationId,
      fileName: attachment.fileName,
      stagingRoot,
    });
    const baseLine = `- ${attachment.fileName} (${attachment.mimeType}) at ${localPath}`;

    if (part.type === "audio") {
      const transcript =
        typeof part.transcript === "string" ? part.transcript.trim() : "";
      const mimeType = normalizeWorkspaceChatAudioMimeType(
        part.mimeType || attachment.mimeType,
      );
      mediaAttachments.push({
        localPath,
        mimeType,
      });

      if (transcript) {
        transcripts.push(transcript);
      }

      continue;
    }

    attachmentLines.push(baseLine);
  }

  const sections = [];

  if (textSegments.length > 0) {
    sections.push(textSegments.join("\n\n"));
  }

  if (attachmentLines.length > 0) {
    sections.push(`Attached files:\n${attachmentLines.join("\n")}`);
  }

  const promptText = sections.join("\n\n").trim();

  if (!promptText && mediaAttachments.length === 0) {
    throw new Error("workspace chat inbound parts did not produce prompt text");
  }

  return {
    mediaAttachments,
    promptText: promptText || "Voice note attached.",
    transcript:
      transcripts.length === 1 ? transcripts[0] : undefined,
  };
}

function normalizeWorkspaceChatAudioMimeType(mimeType) {
  const normalized =
    typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";

  if (normalized === "video/webm" || normalized.startsWith("video/webm;")) {
    return normalized.replace("video/webm", "audio/webm");
  }

  if (normalized === "video/mp4" || normalized.startsWith("video/mp4;")) {
    return normalized.replace("video/mp4", "audio/mp4");
  }

  return normalized || "audio/webm";
}

async function stageWorkspaceChatAttachmentFile(input) {
  const directoryPath = path.join(input.stagingRoot, input.conversationId);
  const safeFileName = sanitizeFileName(input.fileName);
  const filePath = path.join(
    directoryPath,
    `${input.attachmentId}-${safeFileName}`,
  );

  await mkdir(directoryPath, { recursive: true });
  await writeFile(filePath, input.bytes);

  return filePath;
}

function sanitizeFileName(value) {
  const normalized = path
    .basename(typeof value === "string" ? value : "attachment")
    .replace(/\0/g, "")
    .trim();

  return normalized || "attachment";
}
