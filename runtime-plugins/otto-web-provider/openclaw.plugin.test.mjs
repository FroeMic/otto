import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("otto-web-provider declares the Otto-managed web search provider contract", async () => {
  const raw = await readFile(
    new URL("./openclaw.plugin.json", import.meta.url),
    "utf-8",
  );
  const plugin = JSON.parse(raw);

  assert.deepEqual(plugin.contracts?.webSearchProviders, ["otto-web-search"]);
});
