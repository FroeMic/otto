import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDefaultWhatsAppRuntimeConfig } from "@/lib/whatsapp-config";
import {
  deriveWhatsAppPolicyEffects,
  isWhatsAppPolicyDestructive,
} from "@/tools/whatsapp/policy";

describe("deriveWhatsAppPolicyEffects", () => {
  it("falls back to DM allowlist for group senders", () => {
    const effects = deriveWhatsAppPolicyEffects({
      config: {
        ...getDefaultWhatsAppRuntimeConfig(),
        allowedGroupIds: ["1234567890@g.us"],
        allowedNumbers: ["+436641234567"],
        dmPolicy: "allowlist",
        groupAllowedNumbers: [],
        groupPolicy: "allowlist",
      },
    });

    assert.deepEqual(effects.effectiveGroupAllowedNumbers, ["+436641234567"]);
    assert.equal(effects.groupRepliesEnabled, true);
  });

  it("flags a fully locked out configuration as destructive", () => {
    const currentConfig = {
      ...getDefaultWhatsAppRuntimeConfig(),
      allowedGroupIds: ["1234567890@g.us"],
      allowedNumbers: ["+436641234567"],
      dmPolicy: "allowlist" as const,
      groupPolicy: "allowlist" as const,
    };
    const effects = deriveWhatsAppPolicyEffects({
      config: {
        ...currentConfig,
        allowedGroupIds: [],
        allowedNumbers: [],
        dmPolicy: "disabled",
        groupAllowedNumbers: [],
        groupPolicy: "disabled",
      },
      currentConfig,
    });

    assert.equal(effects.wouldFullyLockOutWhatsApp, true);
    assert.equal(isWhatsAppPolicyDestructive(effects), true);
    assert.match(
      effects.warnings.join("\n"),
      /fully locks Otto out of WhatsApp/i,
    );
  });
});
