export type OpenClawTenantConfig = {
  authTokenEnvVar: string;
  gatewayPort: number;
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
    },
    null,
    2,
  );
}
