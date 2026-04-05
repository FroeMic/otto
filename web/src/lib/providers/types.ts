export const PROVIDER_KEYS = {
  openai: "openai",
} as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[keyof typeof PROVIDER_KEYS];

export type ProvisionTenantCredentialResult = {
  apiKey: string;
  apiKeyId: string | null;
  displayName: string;
  projectId: string;
  providerKey: ProviderKey;
  serviceAccountId: string;
};

export interface ProviderProvisioner {
  createTenantCredential(input: {
    existingProjectId?: string | null;
    tenantId: string;
    tenantName: string;
    verify?: boolean;
  }): Promise<ProvisionTenantCredentialResult>;
}
