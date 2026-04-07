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
          id: "otto-runtime-config",
          timeoutMs: 15_000,
        },
        {
          config: {
            manifest: [
              {
                key: "demo-linear",
                label: "Demo Linear",
                operations: [
                  {
                    description: "Search demo issues.",
                    key: "search_issues",
                    label: "Search Issues",
                  },
                ],
                parametersSchema: {
                  additionalProperties: false,
                  properties: {
                    operation: {
                      const: "search_issues",
                      type: "string",
                    },
                    query: {
                      minLength: 1,
                      type: "string",
                    },
                  },
                  required: ["operation", "query"],
                  type: "object",
                },
                toolDescription: "Search demo Linear issues.",
                toolName: "demo_linear",
              },
            ],
          },
          id: "otto-integrations",
          timeoutMs: 15_000,
        },
        {
          id: "otto-session-reporter",
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
      "otto-runtime-config",
      "otto-integrations",
      "otto-session-reporter",
    ]);
    assert.deepEqual(renderedConfig.tools.exec, {
      ask: "off",
      host: "gateway",
      security: "full",
    });
    assert.deepEqual(renderedConfig.plugins.allow, [
      "otto-managed-config",
      "otto-runtime-config",
      "otto-integrations",
      "otto-session-reporter",
    ]);
    assert.deepEqual(renderedConfig.plugins.entries["otto-integrations"], {
      config: {
        manifest: [
          {
            key: "demo-linear",
            label: "Demo Linear",
            operations: [
              {
                description: "Search demo issues.",
                key: "search_issues",
                label: "Search Issues",
              },
            ],
            parametersSchema: {
              additionalProperties: false,
              properties: {
                operation: {
                  const: "search_issues",
                  type: "string",
                },
                query: {
                  minLength: 1,
                  type: "string",
                },
              },
              required: ["operation", "query"],
              type: "object",
            },
            toolDescription: "Search demo Linear issues.",
            toolName: "demo_linear",
          },
        ],
        timeoutMs: 15_000,
      },
      enabled: true,
    });
    assert.deepEqual(renderedConfig.tools.media.audio, {
      enabled: true,
      maxBytes: 20 * 1024 * 1024,
      models: [{ model: "gpt-4o-mini-transcribe", provider: "openai" }],
    });
    assert.deepEqual(renderedConfig.session, {
      dmScope: "per-channel-peer",
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
        mode: "http",
        requireMentionInChannels: true,
        signingSecret: "test-signing-secret",
        webhookPath: "/slack/events",
      },
      tenantId: "tenant_123",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.doesNotThrow(() =>
      validateOpenClawSlackConfig(renderedConfig.channels.slack),
    );
    assert.deepEqual(renderedConfig.channels.slack.execApprovals, {
      enabled: false,
    });
    assert.equal(renderedConfig.channels.slack.webhookPath, "/slack/events");
    assert.deepEqual(renderedConfig.channels.slack.channels, {
      C123: {
        enabled: true,
        requireMention: true,
      },
    });
  });

  it("renders member-of-channels Slack access with enabled wildcard entries", () => {
    const config: OpenClawTenantConfig = {
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: ["slack"],
      prompts: {},
      slack: {
        ackReactionEnabled: false,
        allowedChannelIds: [],
        allowedUserIds: ["U123"],
        answerInThreads: false,
        channelAccessMode: "member_of_channels",
        enabled: true,
        mode: "http",
        requireMentionInChannels: false,
        signingSecret: "test-signing-secret",
        webhookPath: "/slack/events",
      },
      tenantId: "tenant_123",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.deepEqual(renderedConfig.channels.slack.channels, {
      "*": {
        enabled: true,
        requireMention: false,
      },
    });
  });

  it("renders Brave web search config into OpenClaw tools", () => {
    const config: OpenClawTenantConfig = {
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: [],
      prompts: {},
      tenantId: "tenant_123",
      webSearch: {
        brave: {
          mode: "web",
        },
        cacheTtlMinutes: 15,
        enabled: true,
        maxResults: 5,
        provider: "brave",
        timeoutSeconds: 30,
      },
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.deepEqual(renderedConfig.tools.web.search, {
      cacheTtlMinutes: 15,
      enabled: true,
      maxResults: 5,
      provider: "brave",
      timeoutSeconds: 30,
    });
    assert.deepEqual(renderedConfig.plugins.allow, ["brave"]);
    assert.equal(renderedConfig.plugins.entries.brave.enabled, true);
    assert.deepEqual(renderedConfig.plugins.entries.brave.config.webSearch, {
      mode: "web",
    });
  });

  it("renders WhatsApp config with the Otto-managed defaults", () => {
    const config: OpenClawTenantConfig = {
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      envelopeTimezone: "user",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: ["whatsapp"],
      prompts: {},
      tenantId: "tenant_123",
      timeFormat: "auto",
      userTimezone: "Europe/Berlin",
      whatsapp: {
        ackReactionEnabled: true,
        allowedGroupIds: ["1234567890@g.us"],
        allowedNumbers: ["+436641234567"],
        dmPolicy: "allowlist",
        enabled: true,
        groupAllowedNumbers: [],
        groupPolicy: "allowlist",
        requireMentionInGroups: true,
      },
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.deepEqual(renderedConfig.channels.whatsapp, {
      ackReaction: {
        direct: true,
        emoji: "👀",
        group: "mentions",
      },
      allowFrom: ["+436641234567"],
      configWrites: false,
      dmPolicy: "allowlist",
      enabled: true,
      groupAllowFrom: ["+436641234567"],
      groupPolicy: "allowlist",
      groups: {
        "1234567890@g.us": {
          requireMention: true,
        },
      },
    });
    assert.deepEqual(renderedConfig.gateway.tools.allow, [
      "cron",
      "whatsapp_login",
    ]);
    assert.equal(renderedConfig.agents.defaults.envelopeTimezone, "user");
    assert.equal(renderedConfig.agents.defaults.timeFormat, "auto");
    assert.equal(renderedConfig.agents.defaults.userTimezone, "Europe/Berlin");
  });

  it("renders openai-proxy as a provider plugin-backed model config", () => {
    const config: OpenClawTenantConfig = {
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: [],
      modelProviders: {
        "openai-proxy": {
          api: "openai-responses",
          // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
          apiKey: "${TENANT_TOKEN}",
          baseUrl:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
            "${OTTO_CONTROL_PLANE_BASE_URL}/api/internal/runtime/ai/openai/v1",
          models: [],
        },
      },
      ottoProviderPlugins: [
        {
          id: "otto-ai-provider",
        },
      ],
      primaryModel: "openai-proxy/gpt-5.4",
      prompts: {},
      tenantId: "tenant_123",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.equal(
      renderedConfig.agents.defaults.model.primary,
      "openai-proxy/gpt-5.4",
    );
    assert.deepEqual(renderedConfig.plugins.allow, ["otto-ai-provider"]);
    assert.equal(
      renderedConfig.plugins.entries["otto-ai-provider"].enabled,
      true,
    );
    assert.deepEqual(renderedConfig.models.providers["openai-proxy"], {
      api: "openai-responses",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
      apiKey: "${TENANT_TOKEN}",
      baseUrl:
        // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
        "${OTTO_CONTROL_PLANE_BASE_URL}/api/internal/runtime/ai/openai/v1",
      models: [],
    });
    assert.equal(renderedConfig.tools.alsoAllow, undefined);
  });

  it("routes audio transcription through openai-proxy when the proxy provider is configured", () => {
    const config: OpenClawTenantConfig = {
      audio: {
        enabled: true,
        maxBytes: 20 * 1024 * 1024,
        models: [{ model: "gpt-4o-mini-transcribe", provider: "openai" }],
      },
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: ["slack"],
      modelProviders: {
        "openai-proxy": {
          api: "openai-responses",
          // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
          apiKey: "${TENANT_TOKEN}",
          baseUrl:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
            "${OTTO_CONTROL_PLANE_BASE_URL}/api/internal/runtime/ai/openai/v1",
          models: [],
        },
      },
      ottoProviderPlugins: [
        {
          id: "otto-ai-provider",
        },
      ],
      prompts: {},
      tenantId: "tenant_123",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.deepEqual(renderedConfig.tools.media.audio, {
      enabled: true,
      maxBytes: 20 * 1024 * 1024,
      models: [{ model: "gpt-4o-mini-transcribe", provider: "openai-proxy" }],
    });
  });

  it("renders custom workspace time settings into agent defaults", () => {
    const config: OpenClawTenantConfig = {
      authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
      envelopeTimezone: "user",
      gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
      integrations: [],
      prompts: {},
      tenantId: "tenant_123",
      timeFormat: "24",
      userTimezone: "America/New_York",
      workspacePath: "/home/node/.openclaw/workspace",
    };

    const renderedConfig = JSON.parse(renderOpenClawConfig(config));

    assert.equal(renderedConfig.agents.defaults.envelopeTimezone, "user");
    assert.equal(renderedConfig.agents.defaults.timeFormat, "24");
    assert.equal(
      renderedConfig.agents.defaults.userTimezone,
      "America/New_York",
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
