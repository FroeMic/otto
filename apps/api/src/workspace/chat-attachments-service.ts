import path from "node:path"

import type { WorkspaceChatAttachment } from "@otto/feature-workspace-chat"

import {
  createWorkspaceChatAttachmentRecord,
  getWorkspaceChatAttachmentForTenant,
  listWorkspaceChatAttachmentsByIds,
  type WorkspaceChatAttachmentRecord,
} from "./chat-attachments-data"
import {
  deleteWorkspaceChatAttachmentFile,
  readWorkspaceChatAttachmentFile,
  storeWorkspaceChatAttachmentFile,
} from "./chat-attachments-storage"
import { resolveWorkspaceChatActor } from "./chat-data"

const MAX_WORKSPACE_CHAT_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024
const UPLOADED_ATTACHMENT_STATUS = "uploaded"

type WorkspaceChatUploadFile = {
  arrayBuffer: () => Promise<ArrayBuffer>
  name: string
  size: number
  type: string
}

export async function createWorkspaceChatAttachment(input: {
  file: WorkspaceChatUploadFile
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceChatAttachment> {
  validateWorkspaceChatUpload(input.file)

  const actor = await resolveWorkspaceChatActor({
    includeTenant: true,
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (!actor.tenantId) {
    throw new Error("Workspace tenant runtime is not ready yet.")
  }

  const fileName = sanitizeUploadedFileName(input.file.name)
  const mimeType = normalizeMimeType(input.file.type)
  const bytes = new Uint8Array(await input.file.arrayBuffer())
  const stored = await storeWorkspaceChatAttachmentFile({
    bytes,
    tenantId: actor.tenantId,
  })

  try {
    const record = await createWorkspaceChatAttachmentRecord({
      fileName,
      mimeType,
      organizationId: actor.organizationId,
      sha256: stored.sha256,
      sizeBytes: stored.sizeBytes,
      status: UPLOADED_ATTACHMENT_STATUS,
      storageKey: stored.storageKey,
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
    })

    return mapWorkspaceChatAttachmentRecord(record)
  } catch (error) {
    await deleteWorkspaceChatAttachmentFile(stored.storageKey)
    throw error
  }
}

export async function getWorkspaceChatAttachmentContentForTenant(input: {
  attachmentId: string
  tenantId: string
}) {
  const record = await getWorkspaceChatAttachmentForTenant(input)

  if (!record) {
    return null
  }

  let file

  try {
    file = await readWorkspaceChatAttachmentFile(record.storageKey)
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return null
    }

    throw error
  }

  return {
    attachment: mapWorkspaceChatAttachmentRecord(record),
    bytes: file.bytes,
    sha256: record.sha256,
  }
}

export async function validateWorkspaceChatAttachmentOwnership(input: {
  attachmentIds: string[]
  orgSlug: string
  userExternalId: string
}) {
  if (input.attachmentIds.length === 0) {
    return
  }

  const actor = await resolveWorkspaceChatActor({
    includeTenant: false,
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const records = await listWorkspaceChatAttachmentsByIds({
    attachmentIds: input.attachmentIds,
    organizationId: actor.organizationId,
    userId: actor.userId,
  })

  if (records.length !== new Set(input.attachmentIds).size) {
    throw new Error("One or more workspace chat attachments are unavailable.")
  }
}

function mapWorkspaceChatAttachmentRecord(
  record: WorkspaceChatAttachmentRecord,
): WorkspaceChatAttachment {
  return {
    fileName: record.fileName,
    id: record.id,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
  }
}

function validateWorkspaceChatUpload(file: WorkspaceChatUploadFile) {
  if (!sanitizeUploadedFileName(file.name)) {
    throw new Error("Workspace chat attachment filename is required.")
  }

  if (file.size <= 0) {
    throw new Error("Workspace chat attachment file is empty.")
  }

  if (file.size > MAX_WORKSPACE_CHAT_ATTACHMENT_SIZE_BYTES) {
    throw new Error(
      `Workspace chat attachments must be ${Math.floor(MAX_WORKSPACE_CHAT_ATTACHMENT_SIZE_BYTES / (1024 * 1024))} MB or smaller.`,
    )
  }
}

function sanitizeUploadedFileName(value: string) {
  const normalized = path.basename(value ?? "").replace(/\0/g, "").trim()
  return normalized
}

function normalizeMimeType(value: string) {
  const normalized = value.trim()
  return normalized || "application/octet-stream"
}
