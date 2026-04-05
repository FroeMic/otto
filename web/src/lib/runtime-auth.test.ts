import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRuntimeAuthLogContext } from "@/lib/runtime-auth";

describe("buildRuntimeAuthLogContext", () => {
  it("includes request metadata and a token fingerprint", () => {
    const request = new Request(
      "https://otto.test/api/internal/runtime/sessions/sync?reason=startup",
      {
        headers: {
          "content-type": "application/json",
          "user-agent": "otto-session-reporter/1.0",
          "x-forwarded-for": "203.0.113.10, 10.0.0.5",
        },
        method: "POST",
      },
    );

    const context = buildRuntimeAuthLogContext({
      request,
      tenantToken: "tenant-secret-token",
    });

    assert.match(context, /method="POST"/);
    assert.match(
      context,
      /path="\/api\/internal\/runtime\/sessions\/sync\?reason=startup"/,
    );
    assert.match(context, /ip="203\.0\.113\.10"/);
    assert.match(context, /contentType="application\/json"/);
    assert.match(context, /userAgent="otto-session-reporter\/1\.0"/);
    assert.match(context, /tokenFingerprint="[0-9a-f]{12}"/);
    assert.doesNotMatch(context, /tenant-secret-token/);
  });

  it("falls back cleanly when optional headers are missing", () => {
    const request = {
      headers: new Headers(),
      method: "GET",
      url: "not-a-valid-url",
    };

    const context = buildRuntimeAuthLogContext({
      request,
      tenantToken: "another-secret",
    });

    assert.match(context, /method="GET"/);
    assert.match(context, /path="not-a-valid-url"/);
    assert.doesNotMatch(context, /\bip=/);
    assert.doesNotMatch(context, /\bcontentType=/);
    assert.doesNotMatch(context, /\buserAgent=/);
  });
});
