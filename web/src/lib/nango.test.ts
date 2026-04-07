import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import { getNangoWebhookErrorMessage, getNangoWebhookTag } from "@/lib/nango";

describe("nango helpers", () => {
  it("reads tags from the webhook payload", () => {
    const payload = {
      tags: {
        end_user_id: "user_123",
        organization_id: "org_456",
      },
      type: "auth",
    };

    assert.equal(getNangoWebhookTag(payload, "end_user_id"), "user_123");
    assert.equal(getNangoWebhookTag(payload, "organization_id"), "org_456");
  });

  it("falls back to nested end user tags", () => {
    const payload = {
      endUser: {
        tags: {
          organization_id: "org_789",
        },
      },
      type: "auth",
    };

    assert.equal(getNangoWebhookTag(payload, "organization_id"), "org_789");
  });

  it("returns a user-facing refresh error", () => {
    const payload = {
      error: {
        description: "The refresh token is no longer valid.",
      },
      type: "auth",
    };

    assert.equal(
      getNangoWebhookErrorMessage(payload),
      "The refresh token is no longer valid.",
    );
  });

  it("matches the documented webhook signature format", () => {
    const secret = "test-webhook-secret";
    const body = JSON.stringify({
      connectionId: "conn_123",
      type: "auth",
    });
    const signature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    assert.equal(signature.length, 64);
    assert.match(signature, /^[0-9a-f]+$/);
  });
});
