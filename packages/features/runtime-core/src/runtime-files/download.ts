import path from "node:path"

import type {
  RuntimeCommandResult,
  RuntimeDownloadKind,
  RuntimeDownloadResult,
} from "./types"

export class RuntimePathValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RuntimePathValidationError"
  }
}

export async function downloadRuntimePath(input: {
  execute: (command: string) => Promise<RuntimeCommandResult>
  kind: RuntimeDownloadKind
  relativePath: string
  rootPath: string
}): Promise<RuntimeDownloadResult> {
  const normalizedRelativePath = normalizeRelativePath(input.relativePath)
  const result = await input.execute(
    buildRuntimeDownloadCommand({
      kind: input.kind,
      relativePath: normalizedRelativePath,
      rootPath: input.rootPath,
    }),
  )

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || "Failed to download runtime path.")
  }

  const payload = parseDownloadPayload(result.stdout)
  const downloadName = buildDownloadName({
    kind: input.kind,
    relativePath: normalizedRelativePath,
  })

  return {
    bytes: Buffer.from(payload.base64, "base64"),
    contentType:
      input.kind === "directory"
        ? "application/zip"
        : (payload.contentType ?? "application/octet-stream"),
    downloadName,
  }
}

function buildDownloadName(input: {
  kind: RuntimeDownloadKind
  relativePath: string
}) {
  const baseName = path.posix.basename(input.relativePath)

  if (input.kind === "directory") {
    return `${baseName || "folder"}.zip`
  }

  return baseName || "download"
}

function buildRuntimeDownloadCommand(input: {
  kind: RuntimeDownloadKind
  relativePath: string
  rootPath: string
}) {
  return buildShellCommand([
    `export OTTO_DOWNLOAD_ROOT=${shellQuote(input.rootPath)}`,
    `export OTTO_DOWNLOAD_KIND=${shellQuote(input.kind)}`,
    `export OTTO_DOWNLOAD_RELATIVE_PATH=${shellQuote(input.relativePath)}`,
    "python3 - <<'PY'",
    "import base64",
    "import io",
    "import json",
    "import mimetypes",
    "import os",
    "import zipfile",
    "from pathlib import Path",
    "",
    "root = Path(os.environ['OTTO_DOWNLOAD_ROOT']).resolve()",
    "relative_path = os.environ['OTTO_DOWNLOAD_RELATIVE_PATH']",
    "kind = os.environ['OTTO_DOWNLOAD_KIND']",
    "target = (root / relative_path).resolve()",
    "",
    "if root != target and root not in target.parents:",
    "    raise SystemExit('Requested path escapes the workspace root.')",
    "",
    "if kind == 'directory':",
    "    if not target.is_dir():",
    "        raise SystemExit('Requested directory does not exist.')",
    "",
    "    buffer = io.BytesIO()",
    "    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:",
    "        for file_path in sorted(target.rglob('*')):",
    "            if file_path.is_file():",
    "                archive.write(file_path, arcname=file_path.relative_to(target).as_posix())",
    "",
    "    payload = {",
    "        'base64': base64.b64encode(buffer.getvalue()).decode('ascii'),",
    "        'contentType': 'application/zip',",
    "    }",
    "else:",
    "    if not target.is_file():",
    "        raise SystemExit('Requested file does not exist.')",
    "",
    "    payload = {",
    "        'base64': base64.b64encode(target.read_bytes()).decode('ascii'),",
    "        'contentType': mimetypes.guess_type(target.as_posix())[0],",
    "    }",
    "",
    "print(json.dumps(payload))",
    "PY",
  ])
}

function normalizeRelativePath(value: string) {
  const normalized = value.trim().replaceAll("\\", "/")

  if (!normalized || normalized === "." || normalized === "/") {
    throw new RuntimePathValidationError("A file or folder path is required.")
  }

  const parts = normalized.split("/").filter(Boolean)

  if (parts.length === 0 || parts.some((part) => part === "..")) {
    throw new RuntimePathValidationError("Invalid file or folder path.")
  }

  return parts.join("/")
}

function parseDownloadPayload(stdout: string) {
  let payload: unknown

  try {
    payload = JSON.parse(stdout)
  } catch (error) {
    throw new Error(
      `Runtime download returned invalid JSON: ${
        error instanceof Error ? error.message : "unknown parse error"
      }`,
    )
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Runtime download returned an empty payload.")
  }

  const candidate = payload as {
    base64?: unknown
    contentType?: unknown
  }

  if (typeof candidate.base64 !== "string" || candidate.base64.length === 0) {
    throw new Error("Runtime download payload did not include file bytes.")
  }

  return {
    base64: candidate.base64,
    contentType:
      typeof candidate.contentType === "string" ? candidate.contentType : null,
  }
}

function buildShellCommand(lines: string[]) {
  return `bash -lc ${shellQuote(lines.join("\n"))}`
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}
