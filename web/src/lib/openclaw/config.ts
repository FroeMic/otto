export type OpenClawTenantConfig = {
  tenantId: string;
  integrations: string[];
  prompts: Record<string, string>;
};

export function renderOpenClawConfig(config: OpenClawTenantConfig): string {
  return JSON.stringify(
    {
      tenantId: config.tenantId,
      integrations: config.integrations,
      prompts: config.prompts,
    },
    null,
    2,
  );
}
