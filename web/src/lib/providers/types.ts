export const PROVIDER_KEYS = {
  openai: "openai",
} as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[keyof typeof PROVIDER_KEYS];

export const PROVIDER_USAGE_TYPES = {
  completions: "completions",
} as const;

export type ProviderUsageType =
  (typeof PROVIDER_USAGE_TYPES)[keyof typeof PROVIDER_USAGE_TYPES];

export const PROVIDER_USAGE_BUCKET_WIDTHS = {
  oneMinute: "1m",
} as const;

export type ProviderUsageBucketWidth =
  (typeof PROVIDER_USAGE_BUCKET_WIDTHS)[keyof typeof PROVIDER_USAGE_BUCKET_WIDTHS];

export const PROVIDER_USAGE_GROUP_BY_FIELDS = {
  apiKeyId: "api_key_id",
  model: "model",
  projectId: "project_id",
  userId: "user_id",
} as const;

export type ProviderUsageGroupByField =
  (typeof PROVIDER_USAGE_GROUP_BY_FIELDS)[keyof typeof PROVIDER_USAGE_GROUP_BY_FIELDS];

export type ProvisionTenantCredentialResult = {
  apiKey: string;
  apiKeyId: string | null;
  displayName: string;
  projectId: string;
  providerKey: ProviderKey;
  serviceAccountId: string;
};

export type ProviderUsageBucketResult = {
  bucketEndAt: Date;
  bucketKey: string;
  bucketStartAt: Date;
  externalApiKeyId: string | null;
  externalProjectId: string | null;
  externalUserId: string | null;
  metrics: Record<string, unknown>;
  model: string | null;
  rawBucket: Record<string, unknown>;
  rawResult: Record<string, unknown>;
};

export type FetchUsageBucketsResult = {
  buckets: ProviderUsageBucketResult[];
  nextPage: string | null;
  rawPage: Record<string, unknown>;
};

export interface ProviderProvisioner {
  createTenantCredential(input: {
    existingProjectId?: string | null;
    tenantId: string;
    tenantName: string;
    verify?: boolean;
  }): Promise<ProvisionTenantCredentialResult>;
  deleteTenantCredential(input: {
    projectId: string;
    serviceAccountId: string;
  }): Promise<void>;
}

export interface ProviderUsageCollector {
  fetchUsageBuckets(input: {
    bucketWidth: ProviderUsageBucketWidth;
    endTime: Date;
    groupBy: ProviderUsageGroupByField[];
    limit?: number;
    page?: string | null;
    projectId: string;
    startTime: Date;
    usageType: ProviderUsageType;
  }): Promise<FetchUsageBucketsResult>;
}
