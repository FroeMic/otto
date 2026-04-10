import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSlackDestructiveChangeError } from "./update-policy";

describe("slack update policy", () => {
  it("blocks runtime-authored full Slack lockout", () => {
    assert.match(
      getSlackDestructiveChangeError({
        allowDestructiveChanges: false,
        createdByType: "runtime",
        isDestructive: true,
        wouldFullyLockOutSlack: true,
      }) ?? "",
      /cannot fully lock Otto out of Slack/,
    );
  });

  it("allows runtime-authored destructive changes that do not fully lock out Slack", () => {
    assert.equal(
      getSlackDestructiveChangeError({
        allowDestructiveChanges: false,
        createdByType: "runtime",
        isDestructive: true,
        wouldFullyLockOutSlack: false,
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
        wouldFullyLockOutSlack: true,
      }) ?? "",
      /Confirm the destructive change/,
    );
  });
});
