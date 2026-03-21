import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseWhatsAppRuntimeConfig } from "@/lib/whatsapp-config";

describe("parseWhatsAppRuntimeConfig", () => {
  it("normalizes and deduplicates phone numbers and group IDs", () => {
    const parsed = parseWhatsAppRuntimeConfig({
      allowedGroupIds: ["1234567890", "1234567890@g.us"],
      allowedNumbers: ["+43 664 1234567", "436641234567"],
      dmPolicy: "allowlist",
      groupAllowedNumbers: ["+43 664 1234568", "436641234568"],
      groupPolicy: "allowlist",
    });

    assert.deepEqual(parsed.allowedNumbers, ["+436641234567"]);
    assert.deepEqual(parsed.groupAllowedNumbers, ["+436641234568"]);
    assert.deepEqual(parsed.allowedGroupIds, ["1234567890@g.us"]);
  });

  it("rejects allowlist DM policy without allowed numbers", () => {
    assert.throws(
      () =>
        parseWhatsAppRuntimeConfig({
          allowedNumbers: [],
          dmPolicy: "allowlist",
        }),
      /Allowlist DMs require at least one allowed WhatsApp number/,
    );
  });

  it("rejects allowlist groups without groups or senders", () => {
    assert.throws(
      () =>
        parseWhatsAppRuntimeConfig({
          allowedGroupIds: [],
          allowedNumbers: [],
          groupAllowedNumbers: [],
          groupPolicy: "allowlist",
        }),
      /Allowlisted groups require at least one WhatsApp group ID/,
    );

    assert.throws(
      () =>
        parseWhatsAppRuntimeConfig({
          allowedGroupIds: ["1234567890@g.us"],
          allowedNumbers: [],
          groupAllowedNumbers: [],
          groupPolicy: "allowlist",
        }),
      /Allowlisted groups require at least one allowed sender number/,
    );
  });
});
