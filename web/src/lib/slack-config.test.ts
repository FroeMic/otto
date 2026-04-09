import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { slackRuntimeConfigPatchSchema } from "./slack-config";

describe("slackRuntimeConfigPatchSchema", () => {
  it("keeps surgical patches sparse without injecting defaults", () => {
    const patch = slackRuntimeConfigPatchSchema.parse({
      ackReactionEnabled: false,
    });

    assert.deepEqual(patch, {
      ackReactionEnabled: false,
    });
    assert.equal("allowedUserIds" in patch, false);
    assert.equal("allowedChannelIds" in patch, false);
    assert.equal("channelAccessMode" in patch, false);
  });

  it("deduplicates provided array fields without adding omitted fields", () => {
    const patch = slackRuntimeConfigPatchSchema.parse({
      allowedUserIds: ["U1", "U1", "U2"],
    });

    assert.deepEqual(patch, {
      allowedUserIds: ["U1", "U2"],
    });
    assert.equal("ackReactionEnabled" in patch, false);
  });
});
