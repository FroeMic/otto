import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPENCLAW_GATEWAY_CONTAINER_PORT,
  type OpenClawTenantConfig,
  renderOpenClawConfig,
} from "@/lib/openclaw/config";

describe("renderOpenClawConfig", () => {
  it("renders audio transcription config alongside managed tools", () => {
    const config: OpenClawTenantConfig = {
      audio: {
        enabled: true,
        maxBytes: 20 * 1024 * 1024,
        models: [{ model: "gpt-4o-mini-transcribe", provider: "openai" }],
      },
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: ["slack"],
      managedConfigPlugin: {
        id: "otto-managed-config",
        timeoutMs: 15_000,
      },
      prompts: {},
      tenantId: "tenant_123",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.deepEqual(renderedConfig.tools.alsoAllow, ["otto-managed-config"]);
    assert.deepEqual(renderedConfig.tools.media.audio, {
      enabled: true,
      maxBytes: 20 * 1024 * 1024,
      models: [{ model: "gpt-4o-mini-transcribe", provider: "openai" }],
    });
  });
});
