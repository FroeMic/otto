import assert from "node:assert/strict";
import test from "node:test";

import { handleStripeWebhookRequest } from "./stripe-webhook";

test("rejects Stripe webhook requests without a signature header", async () => {
  const request = new Request("https://example.com/webhooks/stripe", {
    body: "{}",
    method: "POST",
  });

  const response = await handleStripeWebhookRequest(request);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    error: "Missing Stripe signature header.",
  });
});
