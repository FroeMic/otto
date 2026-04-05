import assert from "node:assert/strict";
import test from "node:test";

import {
  assertTenantCreditsAvailable,
  OpenAiProxyError,
} from "@/lib/runtime-ai/openai-proxy";

test("allows proxy requests when the tenant has a positive credit balance", () => {
  assert.doesNotThrow(() =>
    assertTenantCreditsAvailable({
      balanceCreditsMilli: 1,
      tenantId: "tenant_123",
    }),
  );
});

test("blocks proxy requests when the tenant balance is zero", () => {
  assert.throws(
    () =>
      assertTenantCreditsAvailable({
        balanceCreditsMilli: 0,
        tenantId: "tenant_123",
      }),
    (error) =>
      error instanceof OpenAiProxyError &&
      error.status === 402 &&
      error.message.includes("out of credits"),
  );
});
