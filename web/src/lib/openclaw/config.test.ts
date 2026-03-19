import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPENCLAW_GATEWAY_CONTAINER_PORT,
  type OpenClawTenantConfig,
  renderOpenClawConfig,
} from "@/lib/openclaw/config";
import { validateOpenClawSlackConfig } from "@/lib/openclaw/slack-schema";

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
      ottoPlugins: [
        {
          id: "otto-managed-config",
          timeoutMs: 15_000,
        },
        {
          id: "otto-tool-config",
          timeoutMs: 15_000,
        },
      ],
      prompts: {},
      tenantId: "tenant_123",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.deepEqual(renderedConfig.tools.alsoAllow, [
      "otto-managed-config",
      "otto-tool-config",
    ]);
    assert.deepEqual(renderedConfig.plugins.allow, [
      "otto-managed-config",
      "otto-tool-config",
    ]);
    assert.deepEqual(renderedConfig.tools.media.audio, {
      enabled: true,
      maxBytes: 20 * 1024 * 1024,
      models: [{ model: "gpt-4o-mini-transcribe", provider: "openai" }],
    });
  });

  it("renders a Slack projection that satisfies the pinned OpenClaw schema", () => {
    const config: OpenClawTenantConfig = {
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: ["slack"],
      prompts: {},
      slack: {
        ackReactionEnabled: true,
        allowedChannelIds: ["C123"],
        allowedUserIds: ["U123"],
        answerInThreads: true,
        channelAccessMode: "manual_allowlist",
        enabled: true,
        mode: "socket",
        requireMentionInChannels: true,
      },
      tenantId: "tenant_123",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.doesNotThrow(() =>
      validateOpenClawSlackConfig(renderedConfig.channels.slack),
    );
  });
});

describe("validateOpenClawSlackConfig", () => {
  it("rejects allowlist DM policy without allowFrom", () => {
    assert.throws(
      () =>
        validateOpenClawSlackConfig({
          channels: {},
          dmPolicy: "allowlist",
          enabled: true,
          groupPolicy: "allowlist",
          mode: "socket",
          replyToMode: "off",
          replyToModeByChatType: {
            channel: "off",
            direct: "off",
            group: "off",
          },
          thread: {
            historyScope: "thread",
            initialHistoryLimit: 20,
          },
        }),
      /allowFrom/,
    );
  });
});
