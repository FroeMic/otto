import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("otto-workspace-chat source registers a bundled workspace channel entry", async () => {
  const source = await readFile(new URL("./index.js", import.meta.url), "utf-8");

  assert.match(source, /defineBundledChannelEntry/);
  assert.match(source, /id:\s*"otto-workspace-chat"/);
  assert.match(source, /specifier:\s*"\.\/api\.js"/);
  assert.match(source, /specifier:\s*"\.\/runtime-api\.js"/);
});
