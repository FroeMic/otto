import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { getApiEnv } from "../env"

const DEFAULT_STORAGE_ROOT = "/tmp/otto-workspace-chat-attachments"

export type StoredWorkspaceChatAttachment = {
  sha256: string
  sizeBytes: number
  storageKey: string
}

export function getWorkspaceChatAttachmentStorageRoot() {
  return (
    getApiEnv().WORKSPACE_CHAT_ATTACHMENT_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT
  )
}

export async function storeWorkspaceChatAttachmentFile(input: {
  bytes: Uint8Array
  tenantId: string
}) {
  const storageKey = path.join(input.tenantId, randomUUID())
  const filePath = resolveWorkspaceChatAttachmentPath(storageKey)

  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, input.bytes)

  return {
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    sizeBytes: input.bytes.byteLength,
    storageKey,
  } satisfies StoredWorkspaceChatAttachment
}

export async function readWorkspaceChatAttachmentFile(storageKey: string) {
  const filePath = resolveWorkspaceChatAttachmentPath(storageKey)
  const [bytes, metadata] = await Promise.all([
    readFile(filePath),
    stat(filePath),
  ])

  return {
    bytes,
    sizeBytes: metadata.size,
  }
}

export async function deleteWorkspaceChatAttachmentFile(storageKey: string) {
  const filePath = resolveWorkspaceChatAttachmentPath(storageKey)
  await rm(filePath, { force: true })
}

function resolveWorkspaceChatAttachmentPath(storageKey: string) {
  const root = getWorkspaceChatAttachmentStorageRoot()
  const normalized = storageKey.replace(/^\/+/u, "")
  return path.join(root, normalized)
}
