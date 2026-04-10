import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("otto-managed-skills declares the reduced lifecycle tool contracts", async () => {
  const raw = await readFile(
    new URL("./openclaw.plugin.json", import.meta.url),
    "utf-8",
  );
  const plugin = JSON.parse(raw);

  assert.deepEqual(plugin.contracts?.tools, [
    "list_managed_skills",
    "get_managed_skill",
    "create_managed_skill",
    "update_managed_skill",
    "delete_managed_skill",
  ]);
});
