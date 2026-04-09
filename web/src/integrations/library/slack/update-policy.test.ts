import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSlackDestructiveChangeError } from "./update-policy";

describe("slack update policy", () => {
  it("allows runtime-authored destructive changes", () => {
    assert.equal(
      getSlackDestructiveChangeError({
        allowDestructiveChanges: false,
        createdByType: "runtime",
        isDestructive: true,
      }),
      null,
    );
  });

  it("still requires explicit confirmation for user-authored destructive changes", () => {
    assert.match(
      getSlackDestructiveChangeError({
        allowDestructiveChanges: false,
        createdByType: "user",
        isDestructive: true,
      }) ?? "",
      /Confirm the destructive change/,
    );
  });
});
