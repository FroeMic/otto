import { getControlPlaneBaseUrl, getEnv } from "@/lib/env";
import { validateOpenClawSlackConfig } from "@/lib/openclaw/slack-schema";
import {
  getDefaultSlackRuntimeConfig,
  parseSlackRuntimeConfig,
} from "@/lib/slack-config";
import type { OpenClawWebSearchConfig } from "@/lib/web-search-config";
import { parseWebSearchRuntimeConfig } from "@/lib/web-search-config";

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
  gatewayPort: number;
  ottoPlugins?: Array<{
    id: string;
    timeoutMs: number;
  }>;
  primaryModel?: string;
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
  tenantId: string;
  integrations: string[];
  prompts: Record<string, string>;
  webSearch?: OpenClawWebSearchConfig;
  workspacePath: string;
};

export const OPENCLAW_GATEWAY_BIND = "lan";
export const OPENCLAW_GATEWAY_CONTAINER_PORT = 18789;
export const OPENCLAW_GATEWAY_HOST_PORT = 18791;

export function renderOpenClawConfig(config: OpenClawTenantConfig): string {
  const pluginIds = config.ottoPlugins?.map((plugin) => plugin.id) ?? [];
  const pluginTools =
    pluginIds.length > 0
      ? {
          alsoAllow: pluginIds,
        }
      : undefined;
  const slack = config.slack;
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
                  allow: true,
                  requireMention: slack.requireMentionInChannels,
                },
              }
            : Object.fromEntries(
                slack.allowedChannelIds.map((channelId) => [
                  channelId,
                  {
                    allow: true,
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
            models: config.audio.models,
          },
        },
      }
    : undefined;
  const webTools = config.webSearch
    ? {
        web: {
          search: {
            ...(config.webSearch.brave
              ? {
                  brave: config.webSearch.brave,
                }
              : {}),
            ...(typeof config.webSearch.cacheTtlMinutes === "number"
              ? {
                  cacheTtlMinutes: config.webSearch.cacheTtlMinutes,
                }
              : {}),
            enabled: config.webSearch.enabled,
            ...(config.webSearch.gemini
              ? {
                  gemini: config.webSearch.gemini,
                }
              : {}),
            ...(config.webSearch.grok
              ? {
                  grok: config.webSearch.grok,
                }
              : {}),
            ...(config.webSearch.kimi
              ? {
                  kimi: config.webSearch.kimi,
                }
              : {}),
            ...(typeof config.webSearch.maxResults === "number"
              ? {
                  maxResults: config.webSearch.maxResults,
                }
              : {}),
            ...(config.webSearch.perplexity
              ? {
                  perplexity: config.webSearch.perplexity,
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

  return JSON.stringify(
    {
      agents: {
        defaults: {
          ...(config.primaryModel
            ? {
                model: {
                  primary: config.primaryModel,
                },
              }
            : {}),
          workspace: config.workspacePath,
        },
      },
      ...(config.ottoPlugins && config.ottoPlugins.length > 0
        ? {
            plugins: {
              allow: pluginIds,
              entries: Object.fromEntries(
                config.ottoPlugins.map((plugin) => [
                  plugin.id,
                  {
                    config: {
                      timeoutMs: plugin.timeoutMs,
                    },
                    enabled: true,
                  },
                ]),
              ),
            },
          }
        : {}),
      ...(pluginTools || mediaTools || webTools
        ? {
            tools: {
              ...(pluginTools ?? {}),
              ...(mediaTools ?? {}),
              ...(webTools ?? {}),
            },
          }
        : {}),
      gateway: {
        auth: {
          mode: "token",
          token: `\${${config.authTokenEnvVar}}`,
        },
        bind: OPENCLAW_GATEWAY_BIND,
        mode: "local",
        port: config.gatewayPort,
      },
      ...(slackChannelConfig
        ? {
            channels: {
              slack: slackChannelConfig,
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
  const webSearch = parseWebSearchConfig(config.webSearch);

  return {
    ...(audio ? { audio } : {}),
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    gatewayPort: OPENCLAW_GATEWAY_CONTAINER_PORT,
    integrations: Array.isArray(config.integrations)
      ? config.integrations.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    primaryModel: env.RUNTIME_MODEL_PRIMARY,
    prompts: parseStringRecord(config.prompts),
    ...(controlPlaneBaseUrl
      ? {
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
    ...(webSearch
      ? {
          webSearch,
        }
      : {}),
    tenantId: input.tenantId,
    workspacePath: "/home/node/.openclaw/workspace",
  };
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
