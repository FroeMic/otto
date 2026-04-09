import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("otto-integrations declares the static metatool contracts", async () => {
  const raw = await readFile(
    new URL("./openclaw.plugin.json", import.meta.url),
    "utf-8",
  );
  const plugin = JSON.parse(raw);

  assert.deepEqual(plugin.contracts?.tools, [
    "find_integration_commands",
    "list_integrations",
    "get_integration",
    "get_integration_details",
    "configure_integration",
    "manage_integration",
    "execute_integration_command",
  ]);
});
