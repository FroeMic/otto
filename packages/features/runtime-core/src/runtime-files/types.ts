import * as z from "zod"

export const runtimeDirectoryFileSnapshotSchema = z.object({
  contentText: z.string().nullable(),
  contentType: z.string().nullable(),
  path: z.string().min(1),
  sizeBytes: z.number().nonnegative(),
  storageEncoding: z.enum(["binary", "utf8_text"]),
  truncated: z.boolean(),
})

export type RuntimeDirectoryFileSnapshot = z.infer<
  typeof runtimeDirectoryFileSnapshotSchema
>

export const runtimeDirectorySnapshotSchema = z.object({
  files: z.array(runtimeDirectoryFileSnapshotSchema),
  rootExists: z.boolean(),
  rootPath: z.string().min(1),
})

export type RuntimeDirectorySnapshot = z.infer<
  typeof runtimeDirectorySnapshotSchema
>

export const runtimeDirectoryListingResponseSchema = z.object({
  snapshot: runtimeDirectorySnapshotSchema.nullable(),
  state: z.enum(["pending_setup", "ready"]),
})

export type RuntimeDirectoryListingResponse = z.infer<
  typeof runtimeDirectoryListingResponseSchema
>

export const runtimeDownloadKindSchema = z.enum(["directory", "file"])

export type RuntimeDownloadKind = z.infer<typeof runtimeDownloadKindSchema>

export type RuntimeDownloadResult = {
  bytes: Buffer
  contentType: string
  downloadName: string
}

export type RuntimeCommandResult = {
  exitCode: number | null
  stderr: string
  stdout: string
}

