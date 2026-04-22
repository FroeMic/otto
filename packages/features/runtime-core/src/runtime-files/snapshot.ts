import type {
  RuntimeCommandResult,
  RuntimeDirectoryFileSnapshot,
  RuntimeDirectorySnapshot,
} from "./types"

const MAX_TEXT_PREVIEW_BYTES = 256 * 1024

type RawRuntimeDirectoryFileSnapshot = {
  contentText?: unknown
  contentType?: unknown
  path?: unknown
  sizeBytes?: unknown
  storageEncoding?: unknown
  truncated?: unknown
}

type RawRuntimeDirectorySnapshot = {
  files?: unknown
  rootExists?: unknown
}

export async function getRuntimeDirectorySnapshot(input: {
  execute: (command: string) => Promise<RuntimeCommandResult>
  failureMessage: string
  rootPath: string
}): Promise<RuntimeDirectorySnapshot> {
  const result = await input.execute(
    buildRuntimeDirectorySnapshotCommand(input.rootPath),
  )

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || input.failureMessage)
  }

  let payload: RawRuntimeDirectorySnapshot

  try {
    payload = JSON.parse(result.stdout) as RawRuntimeDirectorySnapshot
  } catch (error) {
    throw new Error(
      `Runtime directory snapshot returned invalid JSON: ${
        error instanceof Error ? error.message : "unknown parse error"
      }`,
    )
  }

  return normalizeRuntimeDirectorySnapshot(payload, input.rootPath)
}

function buildRuntimeDirectorySnapshotCommand(rootPath: string) {
  return buildShellCommand([
    `export OTTO_WORKSPACE_ROOT=${shellQuote(rootPath)}`,
    `export OTTO_MAX_TEXT_PREVIEW_BYTES=${MAX_TEXT_PREVIEW_BYTES}`,
    "python3 - <<'PY'",
    "import json",
    "import mimetypes",
    "import os",
    "from pathlib import Path",
    "",
    "root = Path(os.environ['OTTO_WORKSPACE_ROOT'])",
    "max_bytes = int(os.environ['OTTO_MAX_TEXT_PREVIEW_BYTES'])",
    "payload = {",
    "    'rootExists': root.is_dir(),",
    "    'files': [],",
    "}",
    "",
    "if root.is_dir():",
    "    file_paths = []",
    "    for current_root, _, filenames in os.walk(root):",
    "        for filename in filenames:",
    "            file_paths.append(Path(current_root) / filename)",
    "",
    "    for file_path in sorted(file_paths, key=lambda value: value.relative_to(root).as_posix()):",
    "        relative_path = file_path.relative_to(root).as_posix()",
    "        size_bytes = file_path.stat().st_size",
    "        content_type, _ = mimetypes.guess_type(file_path.as_posix())",
    "        entry = {",
    "            'contentText': None,",
    "            'contentType': content_type,",
    "            'path': relative_path,",
    "            'sizeBytes': size_bytes,",
    "            'storageEncoding': 'binary',",
    "            'truncated': False,",
    "        }",
    "",
    "        try:",
    "            raw = file_path.read_bytes()",
    "        except OSError:",
    "            payload['files'].append(entry)",
    "            continue",
    "",
    "        if len(raw) > max_bytes:",
    "            raw = raw[:max_bytes]",
    "            entry['truncated'] = True",
    "",
    "        try:",
    "            entry['contentText'] = raw.decode('utf-8')",
    "            entry['storageEncoding'] = 'utf8_text'",
    "        except UnicodeDecodeError:",
    "            entry['contentText'] = None",
    "            entry['storageEncoding'] = 'binary'",
    "",
    "        payload['files'].append(entry)",
    "",
    "print(json.dumps(payload))",
    "PY",
  ])
}

function normalizeRuntimeDirectorySnapshot(
  payload: RawRuntimeDirectorySnapshot,
  rootPath: string,
): RuntimeDirectorySnapshot {
  const rootExists = payload.rootExists === true
  const files = Array.isArray(payload.files)
    ? payload.files
        .map(normalizeRuntimeDirectoryFileSnapshot)
        .filter((file) => file !== null)
        .sort((left, right) => left.path.localeCompare(right.path))
    : []

  return {
    files,
    rootExists,
    rootPath,
  }
}

function normalizeRuntimeDirectoryFileSnapshot(
  file: unknown,
): RuntimeDirectoryFileSnapshot | null {
  if (!file || typeof file !== "object") {
    return null
  }

  const candidate = file as RawRuntimeDirectoryFileSnapshot
  const path = typeof candidate.path === "string" ? candidate.path : null
  const sizeBytes =
    typeof candidate.sizeBytes === "number" &&
    Number.isFinite(candidate.sizeBytes)
      ? candidate.sizeBytes
      : null

  if (!path || sizeBytes === null) {
    return null
  }

  return {
    contentText:
      typeof candidate.contentText === "string" ? candidate.contentText : null,
    contentType:
      typeof candidate.contentType === "string" ? candidate.contentType : null,
    path,
    sizeBytes,
    storageEncoding:
      candidate.storageEncoding === "utf8_text" ? "utf8_text" : "binary",
    truncated: candidate.truncated === true,
  }
}

function buildShellCommand(lines: string[]) {
  return `bash -lc ${shellQuote(lines.join("\n"))}`
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}
