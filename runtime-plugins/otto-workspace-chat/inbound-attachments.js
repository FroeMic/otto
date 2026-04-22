import { fetchWorkspaceChatAttachment } from "./control-plane-client.js";

export async function prepareWorkspaceChatInboundParts(input, dependencies = {}) {
  const fetchAttachment =
    dependencies.fetchAttachment ?? fetchWorkspaceChatAttachment;
  const saveAttachmentBuffer =
    dependencies.saveAttachmentBuffer ?? saveWorkspaceChatAttachmentBuffer;
  const textSegments = [];
  const attachmentLines = [];
  const mediaAttachments = [];
  const transcripts = [];

  for (const part of input.parts) {
    if (part.type === "text" || part.type === "hidden_text") {
      const text = part.text.trim();

      if (text) {
        textSegments.push(text);
      }
      continue;
    }

    const attachment = await fetchAttachment(part.attachmentId);
    const normalizedPartMimeType =
      part.type === "audio"
        ? normalizeWorkspaceChatAudioMimeType(
            part.mimeType || attachment.mimeType,
          )
        : attachment.mimeType;
    const localPath = await saveAttachmentBuffer({
      attachmentId: attachment.attachmentId,
      bytes: attachment.bytes,
      fileName: attachment.fileName,
      mimeType: normalizedPartMimeType,
      partType: part.type,
    });
    const baseLine = `- ${attachment.fileName} (${attachment.mimeType}) at ${localPath}`;

    if (part.type === "audio" || isTranscribableMediaMimeType(normalizedPartMimeType)) {
      const transcript =
        typeof part.transcript === "string" ? part.transcript.trim() : "";
      mediaAttachments.push({
        localPath,
        mimeType: normalizedPartMimeType,
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
    transcript: transcripts.length === 1 ? transcripts[0] : undefined,
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

function isTranscribableMediaMimeType(mimeType) {
  const normalized =
    typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";

  return normalized.startsWith("audio/") || normalized.startsWith("video/");
}

async function saveWorkspaceChatAttachmentBuffer(input) {
  const { saveMediaBuffer } = await import(
    "openclaw/plugin-sdk/media-runtime"
  );
  const saved = await saveMediaBuffer(
    input.bytes,
    input.mimeType,
    "inbound",
  );
  return saved.path;
}
