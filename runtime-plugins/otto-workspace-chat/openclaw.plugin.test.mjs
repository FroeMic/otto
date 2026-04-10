import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("otto-workspace-chat declares the workspace chat channel", async () => {
  const raw = await readFile(
    new URL("./openclaw.plugin.json", import.meta.url),
    "utf-8",
  );
  const plugin = JSON.parse(raw);

  assert.deepEqual(plugin.channels, ["otto-workspace-chat"]);
});
