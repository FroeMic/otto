import { DownloadSimpleIcon, FileIcon } from "@phosphor-icons/react"
import type { RuntimeDirectoryFileSnapshot } from "@otto/feature-runtime-core/runtime-files/types"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

export interface RuntimeFilePreviewProps {
  buildDownloadUrl: (input: {
    disposition?: "attachment" | "inline"
    kind?: "directory" | "file"
    path: string
  }) => string
  file: RuntimeDirectoryFileSnapshot | null
}

export function RuntimeFilePreview({
  buildDownloadUrl,
  file,
}: RuntimeFilePreviewProps) {
  if (!file) {
    return (
      <div className="flex h-full min-h-[28rem] items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
        Select a file to preview it here.
      </div>
    )
  }

  const inlineUrl = buildDownloadUrl({
    disposition: "inline",
    kind: "file",
    path: file.path,
  })
  const downloadUrl = buildDownloadUrl({
    disposition: "attachment",
    kind: "file",
    path: file.path,
  })

  return (
    <div className="flex h-full min-h-[28rem] flex-col">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium">{file.path}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(file.sizeBytes)}</span>
            {file.contentType ? <span>{file.contentType}</span> : null}
            {file.truncated ? <Badge variant="secondary">Preview truncated</Badge> : null}
          </div>
        </div>

        <a
          className={buttonVariants({
            size: "sm",
            variant: "outline",
          })}
          href={downloadUrl}
        >
          <DownloadSimpleIcon className="size-4" />
          Download
        </a>
      </div>

      <div className="min-h-0 flex-1 border-t border-border">
        {isPreviewableImage(file) ? (
          <div className="flex h-full items-center justify-center bg-muted/20 p-6">
            <img
              alt={file.path}
              className="max-h-[32rem] max-w-full rounded-md border border-border bg-background object-contain"
              src={inlineUrl}
            />
          </div>
        ) : file.storageEncoding === "utf8_text" && file.contentText !== null ? (
          <pre className="h-full overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-sm leading-6">
            {file.contentText}
          </pre>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <FileIcon className="size-8 text-muted-foreground" />
            <div className="flex max-w-sm flex-col gap-1">
              <span className="text-sm font-medium">Binary file preview unavailable</span>
              <span className="text-sm text-muted-foreground">
                This file can be downloaded, but it cannot be previewed directly in
                the browser.
              </span>
            </div>
            <a
              className={buttonVariants({
                size: "sm",
                variant: "outline",
              })}
              href={downloadUrl}
            >
              <DownloadSimpleIcon className="size-4" />
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPreviewableImage(file: RuntimeDirectoryFileSnapshot) {
  return file.contentType?.startsWith("image/") ?? false
}
