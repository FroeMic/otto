import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = process.cwd();

const TARGET_ROOTS = [
  path.join(REPO_ROOT, "apps/web/src"),
] as const;

const ALLOWED_PATHS = new Set<string>();

const ALLOWED_LINE_PATTERNS = [
  /@\/db\/control-plane/,
  /db\/control-plane/,
  /\bCONTROL_PLANE_/,
  /\bOTTO_CONTROL_PLANE_BASE_URL\b/,
  /\bcontrolPlane[A-Z_]/,
  /\bgetControlPlane/,
  /\brequestControlPlane/,
  /Control-plane request/,
  /\bcontrol_plane_env\b/,
  /\bgetControlPlaneFetchErrorMessage\b/,
];

const BANNED_PATTERNS = [
  { label: "control plane", regex: /\bcontrol plane\b/i },
  { label: "control-plane", regex: /\bcontrol-plane\b/i },
  { label: "Otto link", regex: /\bOtto link\b/ },
];

function walkFiles(targetPath: string): string[] {
  const entryName = path.basename(targetPath);

  if (entryName === "api" || entryName.endsWith(".test.ts")) {
    return [];
  }

  const stat = readdirSync(targetPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of stat) {
    const resolved = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(resolved));
      continue;
    }

    if (!/\.(ts|tsx|js|json|md)$/.test(entry.name)) {
      continue;
    }

    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      continue;
    }

    if (ALLOWED_PATHS.has(resolved)) {
      continue;
    }

    files.push(resolved);
  }

  return files;
}

function collectFiles(targetPath: string): string[] {
  if (ALLOWED_PATHS.has(targetPath)) {
    return [];
  }

  const ext = path.extname(targetPath);
  if (ext) {
    return /\.(ts|tsx|js|json|md)$/.test(ext) ? [targetPath] : [];
  }

  return walkFiles(targetPath);
}

describe("terminology audit", () => {
  it("keeps internal control-plane terminology out of user-facing and agent-facing surfaces", () => {
    const offenses: string[] = [];

    for (const targetRoot of TARGET_ROOTS) {
      for (const filePath of collectFiles(targetRoot)) {
        if (ALLOWED_PATHS.has(filePath)) {
          continue;
        }

        const relativePath = path.relative(REPO_ROOT, filePath);
        const content = readFileSync(filePath, "utf8");
        const lines = content.split("\n");

        for (const [index, line] of lines.entries()) {
          if (
            ALLOWED_LINE_PATTERNS.some((pattern) => pattern.test(line.trim()))
          ) {
            continue;
          }

          for (const { label, regex } of BANNED_PATTERNS) {
            if (!regex.test(line)) {
              continue;
            }

            offenses.push(`${relativePath}:${index + 1} contains ${label}`);
          }
        }
      }
    }

    assert.equal(
      offenses.length,
      0,
      `Terminology audit failed:\n${offenses.join("\n")}`,
    );
  });
});
