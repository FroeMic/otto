import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  workspaceChatAttachments,
  workspaceChatMessageParts,
} from "@otto/feature-integrations-runtime/db/schema"
import { and, eq, inArray } from "drizzle-orm"

export type WorkspaceChatAttachmentRecord = {
  fileName: string
  id: string
  mimeType: string
  organizationId: string
  sha256: string
  sizeBytes: number
  status: string
  storageKey: string
  tenantId: string
  uploadedByUserId: string | null
}

export async function createWorkspaceChatAttachmentRecord(input: {
  fileName: string
  mimeType: string
  organizationId: string
  sha256: string
  sizeBytes: number
  status: string
  storageKey: string
  tenantId: string
  uploadedByUserId: string
}) {
  const db = getDb()
  const [record] = await db
    .insert(workspaceChatAttachments)
    .values({
      fileName: input.fileName,
      mimeType: input.mimeType,
      organizationId: input.organizationId,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      status: input.status,
      storageKey: input.storageKey,
      tenantId: input.tenantId,
      uploadedByUserId: input.uploadedByUserId,
      updatedAt: new Date(),
    })
    .returning({
      fileName: workspaceChatAttachments.fileName,
      id: workspaceChatAttachments.id,
      mimeType: workspaceChatAttachments.mimeType,
      organizationId: workspaceChatAttachments.organizationId,
      sha256: workspaceChatAttachments.sha256,
      sizeBytes: workspaceChatAttachments.sizeBytes,
      status: workspaceChatAttachments.status,
      storageKey: workspaceChatAttachments.storageKey,
      tenantId: workspaceChatAttachments.tenantId,
      uploadedByUserId: workspaceChatAttachments.uploadedByUserId,
    })

  if (!record) {
    throw new Error("Workspace chat attachment record could not be created.")
  }

  return record satisfies WorkspaceChatAttachmentRecord
}

export async function getWorkspaceChatAttachmentForUser(input: {
  attachmentId: string
  organizationId: string
  userId: string
}) {
  const db = getDb()
  const [record] = await db
    .select({
      fileName: workspaceChatAttachments.fileName,
      id: workspaceChatAttachments.id,
      mimeType: workspaceChatAttachments.mimeType,
      organizationId: workspaceChatAttachments.organizationId,
      sha256: workspaceChatAttachments.sha256,
      sizeBytes: workspaceChatAttachments.sizeBytes,
      status: workspaceChatAttachments.status,
      storageKey: workspaceChatAttachments.storageKey,
      tenantId: workspaceChatAttachments.tenantId,
      uploadedByUserId: workspaceChatAttachments.uploadedByUserId,
    })
    .from(workspaceChatAttachments)
    .where(
      and(
        eq(workspaceChatAttachments.id, input.attachmentId),
        eq(workspaceChatAttachments.organizationId, input.organizationId),
        eq(workspaceChatAttachments.uploadedByUserId, input.userId),
      ),
    )
    .limit(1)

  return (record ?? null) satisfies WorkspaceChatAttachmentRecord | null
}

export async function getWorkspaceChatAttachmentForTenant(input: {
  attachmentId: string
  tenantId: string
}) {
  const db = getDb()
  const [record] = await db
    .select({
      fileName: workspaceChatAttachments.fileName,
      id: workspaceChatAttachments.id,
      mimeType: workspaceChatAttachments.mimeType,
      organizationId: workspaceChatAttachments.organizationId,
      sha256: workspaceChatAttachments.sha256,
      sizeBytes: workspaceChatAttachments.sizeBytes,
      status: workspaceChatAttachments.status,
      storageKey: workspaceChatAttachments.storageKey,
      tenantId: workspaceChatAttachments.tenantId,
      uploadedByUserId: workspaceChatAttachments.uploadedByUserId,
    })
    .from(workspaceChatAttachments)
    .where(
      and(
        eq(workspaceChatAttachments.id, input.attachmentId),
        eq(workspaceChatAttachments.tenantId, input.tenantId),
      ),
    )
    .limit(1)

  return (record ?? null) satisfies WorkspaceChatAttachmentRecord | null
}

export async function listWorkspaceChatAttachmentsByIds(input: {
  attachmentIds: string[]
  organizationId: string
  userId: string
}) {
  if (input.attachmentIds.length === 0) {
    return [] satisfies WorkspaceChatAttachmentRecord[]
  }

  const db = getDb()
  const rows = await db
    .select({
      fileName: workspaceChatAttachments.fileName,
      id: workspaceChatAttachments.id,
      mimeType: workspaceChatAttachments.mimeType,
      organizationId: workspaceChatAttachments.organizationId,
      sha256: workspaceChatAttachments.sha256,
      sizeBytes: workspaceChatAttachments.sizeBytes,
      status: workspaceChatAttachments.status,
      storageKey: workspaceChatAttachments.storageKey,
      tenantId: workspaceChatAttachments.tenantId,
      uploadedByUserId: workspaceChatAttachments.uploadedByUserId,
    })
    .from(workspaceChatAttachments)
    .where(
      and(
        inArray(workspaceChatAttachments.id, input.attachmentIds),
        eq(workspaceChatAttachments.organizationId, input.organizationId),
        eq(workspaceChatAttachments.uploadedByUserId, input.userId),
      ),
    )

  return rows satisfies WorkspaceChatAttachmentRecord[]
}

export async function getWorkspaceChatAttachmentIdsForMessage(messageId: string) {
  const db = getDb()
  const rows = await db
    .select({
      attachmentId: workspaceChatMessageParts.attachmentId,
    })
    .from(workspaceChatMessageParts)
    .where(eq(workspaceChatMessageParts.messageId, messageId))

  return rows
    .map((row) => row.attachmentId)
    .filter((attachmentId): attachmentId is string => Boolean(attachmentId))
}
