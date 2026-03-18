import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getMissingSlackScopes,
  hasRequiredSlackScopes,
  SLACK_VOICE_NOTE_REQUIRED_SCOPES,
} from "@/lib/slack-scopes";

describe("slack scope helpers", () => {
  it("detects when the voice-note scope is missing", () => {
    assert.deepEqual(
      getMissingSlackScopes(
        "app_mentions:read,channels:history,chat:write",
        SLACK_VOICE_NOTE_REQUIRED_SCOPES,
      ),
      ["files:read"],
    );
  });

  it("accepts installs that already include the required scope", () => {
    assert.equal(
      hasRequiredSlackScopes(
        "app_mentions:read,files:read,chat:write",
        SLACK_VOICE_NOTE_REQUIRED_SCOPES,
      ),
      true,
    );
  });
});
