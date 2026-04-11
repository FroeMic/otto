import type { RuntimeDirectoryFileSnapshot } from "@otto/feature-runtime-core/runtime-files/types"

export type RuntimeFileTreeNode =
  | {
      children: RuntimeFileTreeNode[]
      kind: "directory"
      name: string
      path: string
    }
  | {
      file: RuntimeDirectoryFileSnapshot
      kind: "file"
      name: string
      path: string
    }
