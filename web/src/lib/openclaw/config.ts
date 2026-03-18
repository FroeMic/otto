import { getControlPlaneBaseUrl, getEnv } from "@/lib/env";
import {
  getDefaultSlackRuntimeConfig,
  parseSlackRuntimeConfig,
} from "@/lib/slack-config";

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
  managedConfigPlugin?: {
    id: string;
    timeoutMs: number;
  };
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
  workspacePath: string;
};

export const OPENCLAW_GATEWAY_BIND = "all";
export const OPENCLAW_GATEWAY_CONTAINER_PORT = 18789;
export const OPENCLAW_GATEWAY_HOST_PORT = 18791;

export function renderOpenClawConfig(config: OpenClawTenantConfig): string {
  const pluginTools = config.managedConfigPlugin
    ? {
        alsoAllow: [config.managedConfigPlugin.id],
      }
    : undefined;
  const slack = config.slack;
  const slackChannelConfig = slack
    ? {
        ackReaction: slack.ackReactionEnabled ? "eyes" : "",
        allowFrom: slack.allowedUserIds,
        channels: Object.fromEntries(
          slack.allowedChannelIds.map((channelId) => [
            channelId,
            {
              allow: true,
              requireMention: slack.requireMentionInChannels,
            },
          ]),
        ),
        dangerouslyAllowNameMatching: false,
        dmPolicy: "allowlist",
        enabled: slack.enabled,
        groupPolicy: "allowlist",
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
      ...(config.managedConfigPlugin
        ? {
            plugins: {
              allow: [config.managedConfigPlugin.id],
              entries: {
                [config.managedConfigPlugin.id]: {
                  config: {
                    timeoutMs: config.managedConfigPlugin.timeoutMs,
                  },
                  enabled: true,
                },
              },
            },
          }
        : {}),
      ...(pluginTools || mediaTools
        ? {
            tools: {
              ...(pluginTools ?? {}),
              ...(mediaTools ?? {}),
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
          managedConfigPlugin: {
            id: "otto-managed-config",
            timeoutMs: 15_000,
          },
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
