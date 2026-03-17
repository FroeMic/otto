import { getControlPlaneBaseUrl, getEnv } from "@/lib/env";

export type OpenClawTenantConfig = {
  authTokenEnvVar: string;
  gatewayPort: number;
  managedConfigPlugin?: {
    id: string;
    timeoutMs: number;
  };
  primaryModel?: string;
  slack?: {
    enabled: boolean;
    mode: "socket";
  };
  tenantId: string;
  integrations: string[];
  prompts: Record<string, string>;
  workspacePath: string;
};

export function renderOpenClawConfig(config: OpenClawTenantConfig): string {
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
            tools: {
              alsoAllow: [config.managedConfigPlugin.id],
            },
          }
        : {}),
      gateway: {
        auth: {
          mode: "token",
          token: `\${${config.authTokenEnvVar}}`,
        },
        bind: "loopback",
        mode: "local",
        port: config.gatewayPort,
      },
      ...(config.slack
        ? {
            channels: {
              slack: {
                allowFrom: ["*"],
                dmPolicy: "open",
                enabled: config.slack.enabled,
                groupPolicy: "open",
                mode: config.slack.mode,
              },
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

  return {
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    gatewayPort: 18789,
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
            enabled: true,
            mode: "socket" as const,
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
