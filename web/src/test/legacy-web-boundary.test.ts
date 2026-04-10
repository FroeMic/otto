import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = process.cwd();
const SOURCE_ROOT = path.join(WEB_ROOT, "src");
const TSCONFIG_PATH = path.join(WEB_ROOT, "tsconfig.json");
const LEGACY_RUNTIME_SURFACES_ROOT = path.join(
  WEB_ROOT,
  "src/app/api/internal/runtime/surfaces",
);

function collectTypeScriptFiles(targetPath: string): string[] {
  const entries = readdirSync(targetPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const resolved = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(resolved));
      continue;
    }

    if (!/\.(ts|tsx|mts)$/.test(entry.name)) {
      continue;
    }

    files.push(resolved);
  }

  return files;
}

describe("legacy web boundary", () => {
  it("does not import shared @otto packages from web/src", () => {
    const offenses: string[] = [];

    for (const filePath of collectTypeScriptFiles(SOURCE_ROOT)) {
      if (filePath.endsWith("legacy-web-boundary.test.ts")) {
        continue;
      }

      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      for (const [index, line] of lines.entries()) {
        if (!/(from\s+["']@otto\/|import\(["']@otto\/)/.test(line)) {
          continue;
        }

        offenses.push(`${path.relative(WEB_ROOT, filePath)}:${index + 1}`);
      }
    }

    assert.equal(
      offenses.length,
      0,
      `Legacy web must not import shared @otto packages:\n${offenses.join("\n")}`,
    );
  });

  it("does not expose @otto path aliases in web/tsconfig.json", () => {
    const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8")) as {
      compilerOptions?: {
        paths?: Record<string, string[]>;
      };
    };
    const pathKeys = Object.keys(tsconfig.compilerOptions?.paths ?? {});
    const offenses = pathKeys.filter((key) => key.startsWith("@otto/"));

    assert.deepEqual(
      offenses,
      [],
      `Legacy web must not define shared @otto path aliases: ${offenses.join(", ")}`,
    );
  });

  it("does not keep legacy runtime surfaces routes in web/src", () => {
    assert.equal(
      existsSync(LEGACY_RUNTIME_SURFACES_ROOT),
      false,
      "Legacy runtime surfaces routes should be removed from web/src/app/api/internal/runtime/surfaces",
    );
  });
});
