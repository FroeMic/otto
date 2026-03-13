export type OpenClawTenantConfig = {
  authTokenEnvVar: string;
  gatewayPort: number;
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
