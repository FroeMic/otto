import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("otto-integrations declares the current managed integration tool contracts", async () => {
  const raw = await readFile(
    new URL("./openclaw.plugin.json", import.meta.url),
    "utf-8",
  );
  const plugin = JSON.parse(raw);

  assert.deepEqual(plugin.contracts?.tools, ["demo_linear", "linear"]);
});
