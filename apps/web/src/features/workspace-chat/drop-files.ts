type WorkspaceChatDropTransferLike = {
  files?: ArrayLike<File> | null
  items?: ArrayLike<{ kind?: string; getAsFile?: () => File | null }> | null
}

export function extractWorkspaceChatDropFiles(
  transfer: WorkspaceChatDropTransferLike | null | undefined,
) {
  if (!transfer) {
    return []
  }

  const itemFiles =
    transfer.items == null
      ? []
      : Array.from(transfer.items)
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile?.() ?? null)
          .filter((file): file is File => file instanceof File)

  if (itemFiles.length > 0) {
    return itemFiles
  }

  return transfer.files == null ? [] : Array.from(transfer.files)
}
