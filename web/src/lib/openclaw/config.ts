import {
  normalizeTimeFormatPreference,
  normalizeTimeZone,
} from "@/lib/date-time";
import { getControlPlaneBaseUrl, getEnv } from "@/lib/env";
import { validateOpenClawSlackConfig } from "@/lib/openclaw/slack-schema";
import {
  getDefaultSlackRuntimeConfig,
  parseSlackRuntimeConfig,
} from "@/lib/slack-config";
import type { OpenClawWebSearchConfig } from "@/lib/web-search-config";
import { parseWebSearchRuntimeConfig } from "@/lib/web-search-config";
import {
  getDefaultWhatsAppRuntimeConfig,
  parseWhatsAppRuntimeConfig,
} from "@/lib/whatsapp-config";

export type OpenClawAudioModelConfig = {
  model: string;
  provider: string;
};

export type OpenClawTenantAudioConfig = {
  echoTranscript?: boolean;
  enabled: boolean;
  maxBytes?: number;
  models: OpenClawAudioModelConfig[];
};

export type OpenClawTenantConfig = {
  audio?: OpenClawTenantAudioConfig;
  authTokenEnvVar: string;
  envelopeTimezone?: "local" | "utc" | "user" | string;
  gatewayPort: number;
  modelProviders?: Record<
    string,
    {
      api?: string;
      apiKey?: string;
      baseUrl?: string;
      models?: Array<{
        id: string;
        name: string;
      }>;
    }
  >;
  ottoPlugins?: Array<{
    config?: Record<string, unknown>;
    id: string;
    timeoutMs: number;
  }>;
  ottoProviderPlugins?: Array<{
    id: string;
  }>;
  primaryModel?: string;
  timeFormat?: "12" | "24" | "auto";
  slack?: {
    ackReactionEnabled: boolean;
    allowedChannelIds: string[];
    allowedUserIds: string[];
    answerInThreads: boolean;
    channelAccessMode: "manual_allowlist" | "member_of_channels";
    enabled: boolean;
    mode: "socket";
    requireMentionInChannels: boolean;
  };
  whatsapp?: {
    ackReactionEnabled: boolean;
    allowedGroupIds: string[];
    allowedNumbers: string[];
    dmPolicy: "pairing" | "allowlist" | "disabled";
    enabled: boolean;
    groupAllowedNumbers: string[];
    groupPolicy: "disabled" | "allowlist";
    requireMentionInGroups: boolean;
  };
  tenantId: string;
  integrations: string[];
  prompts: Record<string, string>;
  userTimezone?: string;
  webSearch?: OpenClawWebSearchConfig;
  workspacePath: string;
};

export const OPENCLAW_GATEWAY_BIND = "lan";
export const OPENCLAW_GATEWAY_CONTAINER_PORT = 18789;
export const OPENCLAW_GATEWAY_HOST_PORT = 18791;

const OPENAI_PROXY_PROVIDER_ID = "openai-proxy";
const OTTO_AI_PROVIDER_PLUGIN_ID = "otto-ai-provider";
const DEFAULT_DISABLED_BUNDLED_PLUGIN_IDS = [
  "amazon-bedrock",
  "amazon-bedrock-mantle",
  "anthropic",
  "anthropic-vertex",
  "arcee",
  "byteplus",
  "chutes",
  "cloudflare-ai-gateway",
  "comfy",
  "copilot-proxy",
  "deepseek",
  "fal",
  "fireworks",
  "github-copilot",
  "google",
  "huggingface",
  "kilocode",
  "kimi-coding",
  "litellm",
  "memory-core",
  "microsoft-foundry",
  "minimax",
  "mistral",
  "moonshot",
  "nvidia",
  "ollama",
  "openai",
  "opencode",
  "opencode-go",
  "openrouter",
  "qianfan",
  "qwen",
  "sglang",
  "stepfun",
  "synthetic",
  "together",
  "venice",
  "vercel-ai-gateway",
  "vllm",
  "volcengine",
  "xai",
  "xiaomi",
  "zai",
] as const;

function buildWebSearchPluginEntries(
  webSearch: OpenClawWebSearchConfig | undefined,
): Record<
  string,
  {
    config: { webSearch: Record<string, unknown> };
    enabled: true;
  }
> {
  if (!webSearch) {
    return {};
  }

  const entries: Record<
    string,
    {
      config: { webSearch: Record<string, unknown> };
      enabled: true;
    }
  > = {};

  if (webSearch.brave) {
    entries.brave = {
      config: {
        webSearch: webSearch.brave,
      },
      enabled: true,
    };
  }

  if (webSearch.gemini) {
    entries.google = {
      config: {
        webSearch: webSearch.gemini,
      },
      enabled: true,
    };
  }

  if (webSearch.grok) {
    entries.xai = {
      config: {
        webSearch: webSearch.grok,
      },
      enabled: true,
    };
  }

  if (webSearch.kimi) {
    entries.moonshot = {
      config: {
        webSearch: webSearch.kimi,
      },
      enabled: true,
    };
  }

  if (webSearch.perplexity) {
    entries.perplexity = {
      config: {
        webSearch: webSearch.perplexity,
      },
      enabled: true,
    };
  }

  return entries;
}

function shouldRouteAudioThroughOpenAiProxy(
  audio: OpenClawTenantAudioConfig | undefined,
) {
  return Boolean(
    audio?.enabled &&
      audio.models.some(
        (model) => normalizeProviderId(model.provider) === "openai",
      ),
  );
}

function normalizeProviderId(value: string) {
  return value.trim().toLowerCase();
}

function buildDefaultDisabledPluginEntries(): Record<
  string,
  {
    enabled: false;
  }
> {
  return Object.fromEntries(
    DEFAULT_DISABLED_BUNDLED_PLUGIN_IDS.map((pluginId) => [
      pluginId,
      { enabled: false as const },
    ]),
  );
}

export function renderOpenClawConfig(config: OpenClawTenantConfig): string {
  const ottoToolPluginIds =
    config.ottoPlugins?.map((plugin) => plugin.id) ?? [];
  const ottoToolPluginEntries = Object.fromEntries(
    (config.ottoPlugins ?? []).map((plugin) => [
      plugin.id,
      {
        config: {
          ...(plugin.config ?? {}),
          timeoutMs: plugin.timeoutMs,
        },
        enabled: true,
      },
    ]),
  );
  const ottoProviderPluginIds =
    config.ottoProviderPlugins?.map((plugin) => plugin.id) ?? [];
  const ottoProviderPluginEntries = Object.fromEntries(
    (config.ottoProviderPlugins ?? []).map((plugin) => [
      plugin.id,
      {
        enabled: true,
      },
    ]),
  );
  const webSearchPluginEntries = buildWebSearchPluginEntries(config.webSearch);
  const defaultDisabledPluginEntries = buildDefaultDisabledPluginEntries();
  const pluginIds = [
    ...new Set([
      ...ottoToolPluginIds,
      ...ottoProviderPluginIds,
      ...Object.keys(webSearchPluginEntries),
    ]),
  ];
  const pluginEntries = {
    ...defaultDisabledPluginEntries,
    ...ottoToolPluginEntries,
    ...ottoProviderPluginEntries,
    ...webSearchPluginEntries,
  };
  const pluginTools =
    ottoToolPluginIds.length > 0
      ? {
          alsoAllow: ottoToolPluginIds,
        }
      : undefined;
  const slack = config.slack;
  const whatsapp = config.whatsapp;
  const slackDirectMessagesEnabled = (slack?.allowedUserIds.length ?? 0) > 0;
  const slackChannelConfig = slack
    ? {
        ackReaction: slack.ackReactionEnabled ? "eyes" : "",
        ...(slackDirectMessagesEnabled
          ? {
              allowFrom: slack.allowedUserIds,
            }
          : {}),
        channels:
          slack.channelAccessMode === "member_of_channels"
            ? {
                "*": {
                  enabled: true,
                  requireMention: slack.requireMentionInChannels,
                },
              }
            : Object.fromEntries(
                slack.allowedChannelIds.map((channelId) => [
                  channelId,
                  {
                    enabled: true,
                    requireMention: slack.requireMentionInChannels,
                  },
                ]),
              ),
        dangerouslyAllowNameMatching: false,
        dmPolicy: slackDirectMessagesEnabled ? "allowlist" : "disabled",
        enabled: slack.enabled,
        groupPolicy:
          slack.channelAccessMode === "member_of_channels"
            ? "open"
            : "allowlist",
        mode: slack.mode,
        replyToMode: "off",
        replyToModeByChatType: {
          channel: slack.answerInThreads ? "all" : "off",
          direct: "off",
          group: "off",
        },
        thread: {
          historyScope: "thread",
          initialHistoryLimit: 20,
        },
      }
    : undefined;
  if (slackChannelConfig) {
    validateOpenClawSlackConfig(slackChannelConfig);
  }
  const whatsappChannelConfig = whatsapp
    ? (() => {
        const whatsappGroupAllowedNumbers =
          whatsapp.groupAllowedNumbers.length > 0
            ? whatsapp.groupAllowedNumbers
            : whatsapp.allowedNumbers;

        return {
          ...(whatsapp.ackReactionEnabled
            ? {
                ackReaction: {
                  direct: true,
                  emoji: "👀",
                  group: "mentions",
                },
              }
            : {}),
          ...(whatsapp.allowedNumbers.length > 0
            ? {
                allowFrom: whatsapp.allowedNumbers,
              }
            : {}),
          configWrites: false,
          dmPolicy: whatsapp.dmPolicy,
          enabled: whatsapp.enabled,
          groupPolicy: whatsapp.groupPolicy,
          ...(whatsapp.groupPolicy === "allowlist" &&
          whatsappGroupAllowedNumbers.length > 0
            ? {
                groupAllowFrom: whatsappGroupAllowedNumbers,
              }
            : {}),
          ...(whatsapp.groupPolicy === "allowlist" &&
          whatsapp.allowedGroupIds.length > 0
            ? {
                groups: Object.fromEntries(
                  whatsapp.allowedGroupIds.map((groupId) => [
                    groupId,
                    {
                      requireMention: whatsapp.requireMentionInGroups,
                    },
                  ]),
                ),
              }
            : {}),
        };
      })()
    : undefined;
  const mediaTools = config.audio
    ? {
        media: {
          audio: {
            ...(typeof config.audio.echoTranscript === "boolean"
              ? {
                  echoTranscript: config.audio.echoTranscript,
                }
              : {}),
            enabled: config.audio.enabled,
            ...(typeof config.audio.maxBytes === "number"
              ? {
                  maxBytes: config.audio.maxBytes,
                }
              : {}),
            models: maybeRewriteAudioModelsToProxy(config),
          },
        },
      }
    : undefined;
  const webTools = config.webSearch
    ? {
        web: {
          search: {
            ...(typeof config.webSearch.cacheTtlMinutes === "number"
              ? {
                  cacheTtlMinutes: config.webSearch.cacheTtlMinutes,
                }
              : {}),
            enabled: config.webSearch.enabled,
            ...(typeof config.webSearch.maxResults === "number"
              ? {
                  maxResults: config.webSearch.maxResults,
                }
              : {}),
            provider: config.webSearch.provider,
            ...(typeof config.webSearch.timeoutSeconds === "number"
              ? {
                  timeoutSeconds: config.webSearch.timeoutSeconds,
                }
              : {}),
          },
        },
      }
    : undefined;
  const execTools = {
    exec: {
      ask: "off",
      host: "gateway",
      security: "full",
    },
  };
  const gatewayToolsAllow = [
    "cron",
    ...(whatsappChannelConfig ? ["whatsapp_login"] : []),
  ];

  return JSON.stringify(
    {
      agents: {
        defaults: {
          ...(config.envelopeTimezone
            ? {
                envelopeTimezone: config.envelopeTimezone,
              }
            : {}),
          ...(config.primaryModel
            ? {
                model: {
                  primary: config.primaryModel,
                },
              }
            : {}),
          ...(config.timeFormat
            ? {
                timeFormat: config.timeFormat,
              }
            : {}),
          ...(config.userTimezone
            ? {
                userTimezone: config.userTimezone,
              }
            : {}),
          workspace: config.workspacePath,
        },
      },
      ...(config.modelProviders
        ? {
            models: {
              providers: config.modelProviders,
            },
          }
        : {}),
      ...(Object.keys(pluginEntries).length > 0 || pluginIds.length > 0
        ? {
            plugins: {
              ...(pluginIds.length > 0
                ? {
                    allow: pluginIds,
                  }
                : {}),
              entries: pluginEntries,
            },
          }
        : {}),
      tools: {
        ...(pluginTools ?? {}),
        ...execTools,
        experimental: {
          planTool: false,
        },
        ...(mediaTools ?? {}),
        ...(webTools ?? {}),
      },
      session: {
        dmScope: "per-channel-peer",
      },
      gateway: {
        auth: {
          mode: "token",
          token: `\${${config.authTokenEnvVar}}`,
        },
        bind: OPENCLAW_GATEWAY_BIND,
        mode: "local",
        port: config.gatewayPort,
        tools: {
          allow: gatewayToolsAllow,
        },
      },
      ...(slackChannelConfig || whatsappChannelConfig
        ? {
            channels: {
              ...(slackChannelConfig
                ? {
                    slack: {
                      ...slackChannelConfig,
                      execApprovals: {
                        enabled: false,
                      },
                    },
                  }
                : {}),
              ...(whatsappChannelConfig
                ? {
                    whatsapp: whatsappChannelConfig,
                  }
                : {}),
            },
          }
        : {}),
    },
    null,
    2,
  );
}

export function buildOpenClawTenantConfig(input: {
  configJson: unknown;
  slackBotToken?: string | null;
  tenantId: string;
}): OpenClawTenantConfig {
  const config = parseRecord(input.configJson);
  const env = getEnv();
  const controlPlaneBaseUrl = getControlPlaneBaseUrl();
  const hasSlackTokens =
    Boolean(env.RUNTIME_SLACK_APP_TOKEN) && Boolean(input.slackBotToken);
  const audio = parseAudioConfig(config.media);
  const slackPolicy = parseSlackPolicy(config.slack);
  const whatsappPolicy = parseWhatsAppPolicy(config.whatsapp);
  const webSearch = parseWebSearchConfig(config.webSearch);
  const userTimezone = normalizeTimeZone(readOptionalString(config.timezone));
  const timeFormat = normalizeTimeFormatPreference(
    readOptionalString(config.timeFormat),
  );
  const primaryModel = env.RUNTIME_MODEL_PRIMARY;
  const proxyModelConfig = resolveProxyModelConfig({
    audioUsesOpenAi: shouldRouteAudioThroughOpenAiProxy(audio),
    controlPlaneBaseUrl,
    primaryModel,
  });
  return {
    ...(audio ? { audio } : {}),
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    envelopeTimezone: "user",
    gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
    integrations: Array.isArray(config.integrations)
      ? config.integrations.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    ...(proxyModelConfig
      ? {
          modelProviders: proxyModelConfig.modelProviders,
          ottoProviderPlugins: proxyModelConfig.plugins,
        }
      : {}),
    primaryModel,
    prompts: parseStringRecord(config.prompts),
    timeFormat,
    ...(controlPlaneBaseUrl
      ? {
          ottoPlugins: [
            {
              id: "otto-managed-config",
              timeoutMs: 15_000,
            },
            {
              id: "otto-managed-skills",
              timeoutMs: 15_000,
            },
            {
              id: "otto-runtime-config",
              timeoutMs: 15_000,
            },
            {
              id: "otto-integrations",
              timeoutMs: 15_000,
            },
            {
              id: "otto-session-reporter",
              timeoutMs: 15_000,
            },
          ],
        }
      : {}),
    ...(hasSlackTokens
      ? {
          slack: {
            ackReactionEnabled: slackPolicy.ackReactionEnabled,
            allowedChannelIds: slackPolicy.allowedChannelIds,
            allowedUserIds: slackPolicy.allowedUserIds,
            answerInThreads: slackPolicy.answerInThreads,
            channelAccessMode: slackPolicy.channelAccessMode,
            enabled: true,
            mode: "socket" as const,
            requireMentionInChannels: slackPolicy.requireMentionInChannels,
          },
        }
      : {}),
    ...(whatsappPolicy
      ? {
          whatsapp: {
            ackReactionEnabled: whatsappPolicy.ackReactionEnabled,
            allowedGroupIds: whatsappPolicy.allowedGroupIds,
            allowedNumbers: whatsappPolicy.allowedNumbers,
            dmPolicy: whatsappPolicy.dmPolicy,
            enabled: true,
            groupAllowedNumbers: whatsappPolicy.groupAllowedNumbers,
            groupPolicy: whatsappPolicy.groupPolicy,
            requireMentionInGroups: whatsappPolicy.requireMentionInGroups,
          },
        }
      : {}),
    ...(webSearch
      ? {
          webSearch,
        }
      : {}),
    tenantId: input.tenantId,
    userTimezone,
    workspacePath: "/home/node/.openclaw/workspace",
  };
}

function resolveProxyModelConfig(input: {
  audioUsesOpenAi: boolean;
  controlPlaneBaseUrl?: string;
  primaryModel: string;
}) {
  const needsProxyConfig =
    input.primaryModel.startsWith(`${OPENAI_PROXY_PROVIDER_ID}/`) ||
    input.audioUsesOpenAi;

  if (!needsProxyConfig) {
    return null;
  }

  if (!input.controlPlaneBaseUrl) {
    throw new Error(
      `${OPENAI_PROXY_PROVIDER_ID} requires OTTO_CONTROL_PLANE_BASE_URL to be configured.`,
    );
  }

  return {
    modelProviders: {
      [OPENAI_PROXY_PROVIDER_ID]: {
        api: "openai-responses",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
        apiKey: "${TENANT_TOKEN}",
        baseUrl:
          // biome-ignore lint/suspicious/noTemplateCurlyInString: OpenClaw config placeholder
          "${OTTO_CONTROL_PLANE_BASE_URL}/api/internal/runtime/ai/openai/v1",
        models: [],
      },
    },
    plugins: [
      {
        id: OTTO_AI_PROVIDER_PLUGIN_ID,
      },
    ],
  };
}

function maybeRewriteAudioModelsToProxy(config: OpenClawTenantConfig) {
  const hasOpenAiProxyProvider =
    Boolean(config.modelProviders?.[OPENAI_PROXY_PROVIDER_ID]) &&
    (config.ottoProviderPlugins ?? []).some(
      (plugin) => plugin.id === OTTO_AI_PROVIDER_PLUGIN_ID,
    );

  if (!hasOpenAiProxyProvider) {
    return config.audio?.models;
  }

  return config.audio?.models.map((model) =>
    normalizeProviderId(model.provider) === "openai"
      ? {
          ...model,
          provider: OPENAI_PROXY_PROVIDER_ID,
        }
      : model,
  );
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseSlackPolicy(value: unknown) {
  const slackConfig = parseRecord(value);

  return parseSlackRuntimeConfig({
    ackReactionEnabled:
      typeof slackConfig.ackReactionEnabled === "boolean"
        ? slackConfig.ackReactionEnabled
        : typeof slackConfig.ackReaction === "string"
          ? slackConfig.ackReaction.trim().length > 0
          : getDefaultSlackRuntimeConfig().ackReactionEnabled,
    allowedChannelIds: parseStringArray(slackConfig.allowedChannelIds),
    allowedUserIds: parseStringArray(slackConfig.allowedUserIds),
    answerInThreads:
      typeof slackConfig.answerInThreads === "boolean"
        ? slackConfig.answerInThreads
        : getDefaultSlackRuntimeConfig().answerInThreads,
    channelAccessMode:
      slackConfig.channelAccessMode === "member_of_channels"
        ? "member_of_channels"
        : getDefaultSlackRuntimeConfig().channelAccessMode,
    requireMentionInChannels:
      typeof slackConfig.requireMentionInChannels === "boolean"
        ? slackConfig.requireMentionInChannels
        : getDefaultSlackRuntimeConfig().requireMentionInChannels,
  });
}

function parseAudioConfig(
  value: unknown,
): OpenClawTenantAudioConfig | undefined {
  const mediaConfig = parseRecord(value);
  const audioConfig = parseRecord(mediaConfig.audio);
  const provider = audioConfig.provider;
  const model = audioConfig.model;

  if (
    audioConfig.enabled !== true ||
    typeof provider !== "string" ||
    provider.length === 0 ||
    typeof model !== "string" ||
    model.length === 0
  ) {
    return undefined;
  }

  return {
    ...(typeof audioConfig.echoTranscript === "boolean"
      ? {
          echoTranscript: audioConfig.echoTranscript,
        }
      : {}),
    enabled: true,
    ...(typeof audioConfig.maxBytes === "number" &&
    Number.isInteger(audioConfig.maxBytes) &&
    audioConfig.maxBytes > 0
      ? {
          maxBytes: audioConfig.maxBytes,
        }
      : {}),
    models: [
      {
        model,
        provider,
      },
    ],
  };
}

function parseWhatsAppPolicy(value: unknown) {
  const whatsappConfig = parseRecord(value);

  if (
    Object.keys(whatsappConfig).length === 0 &&
    !("dmPolicy" in whatsappConfig) &&
    !("groupPolicy" in whatsappConfig)
  ) {
    return undefined;
  }

  return parseWhatsAppRuntimeConfig({
    ackReactionEnabled:
      typeof whatsappConfig.ackReactionEnabled === "boolean"
        ? whatsappConfig.ackReactionEnabled
        : typeof whatsappConfig.ackReaction === "object" &&
            whatsappConfig.ackReaction !== null
          ? true
          : getDefaultWhatsAppRuntimeConfig().ackReactionEnabled,
    allowedGroupIds: parseStringArray(whatsappConfig.allowedGroupIds),
    allowedNumbers: parseStringArray(whatsappConfig.allowedNumbers),
    dmPolicy:
      whatsappConfig.dmPolicy === "allowlist" ||
      whatsappConfig.dmPolicy === "disabled"
        ? whatsappConfig.dmPolicy
        : getDefaultWhatsAppRuntimeConfig().dmPolicy,
    groupAllowedNumbers: parseStringArray(whatsappConfig.groupAllowedNumbers),
    groupPolicy:
      whatsappConfig.groupPolicy === "allowlist"
        ? "allowlist"
        : getDefaultWhatsAppRuntimeConfig().groupPolicy,
    requireMentionInGroups:
      typeof whatsappConfig.requireMentionInGroups === "boolean"
        ? whatsappConfig.requireMentionInGroups
        : getDefaultWhatsAppRuntimeConfig().requireMentionInGroups,
  });
}

function parseWebSearchConfig(
  value: unknown,
): OpenClawWebSearchConfig | undefined {
  const parsed = parseWebSearchRuntimeConfig(value);

  if (!parsed.provider) {
    return undefined;
  }

  return {
    ...(parsed.braveMode
      ? {
          brave: {
            mode: parsed.braveMode,
          },
        }
      : {}),
    ...(typeof parsed.cacheTtlMinutes === "number"
      ? {
          cacheTtlMinutes: parsed.cacheTtlMinutes,
        }
      : {}),
    enabled: true,
    ...(parsed.geminiModel
      ? {
          gemini: {
            model: parsed.geminiModel,
          },
        }
      : {}),
    ...(parsed.grokModel || parsed.grokInlineCitations !== undefined
      ? {
          grok: {
            ...(parsed.grokInlineCitations !== undefined
              ? {
                  inlineCitations: parsed.grokInlineCitations,
                }
              : {}),
            ...(parsed.grokModel
              ? {
                  model: parsed.grokModel,
                }
              : {}),
          },
        }
      : {}),
    ...(parsed.kimiBaseUrl || parsed.kimiModel
      ? {
          kimi: {
            ...(parsed.kimiBaseUrl
              ? {
                  baseUrl: parsed.kimiBaseUrl,
                }
              : {}),
            ...(parsed.kimiModel
              ? {
                  model: parsed.kimiModel,
                }
              : {}),
          },
        }
      : {}),
    ...(typeof parsed.maxResults === "number"
      ? {
          maxResults: parsed.maxResults,
        }
      : {}),
    ...(parsed.perplexityBaseUrl || parsed.perplexityModel
      ? {
          perplexity: {
            ...(parsed.perplexityBaseUrl
              ? {
                  baseUrl: parsed.perplexityBaseUrl,
                }
              : {}),
            ...(parsed.perplexityModel
              ? {
                  model: parsed.perplexityModel,
                }
              : {}),
          },
        }
      : {}),
    provider: parsed.provider,
    ...(typeof parsed.timeoutSeconds === "number"
      ? {
          timeoutSeconds: parsed.timeoutSeconds,
        }
      : {}),
  };
}
