import assert from "node:assert/strict";
import test from "node:test";

import { buildManagedSkillRenameCommand } from "@/lib/runtime/manager";

test("buildManagedSkillRenameCommand emits an idempotent directory move", () => {
  const command = buildManagedSkillRenameCommand([
    {
      fromSkillKey: "test-skill",
      toSkillKey: "random-color",
    },
  ]);

  assert.ok(command);
  assert.match(command ?? "", /mv/);
  assert.match(command ?? "", /test-skill/);
  assert.match(command ?? "", /random-color/);
  assert.match(command ?? "", /already exists/);
});

test("buildManagedSkillRenameCommand returns null when no rename is needed", () => {
  assert.equal(
    buildManagedSkillRenameCommand([
      {
        fromSkillKey: "random-color",
        toSkillKey: "random-color",
      },
    ]),
    null,
  );
});
