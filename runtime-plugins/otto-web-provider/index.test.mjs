import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("otto-web-provider source registers the Otto-managed web search provider", async () => {
  const source = await readFile(new URL("./index.js", import.meta.url), "utf-8");

  assert.match(source, /id:\s*"otto-web-provider"/);
  assert.match(source, /registerWebSearchProvider\(/);
  assert.match(source, /id:\s*PROVIDER_ID/);
  assert.match(source, /const PROVIDER_ID = "otto-web-search"/);
  assert.match(source, /api\/internal\/runtime\/web-search\/search/);
});
