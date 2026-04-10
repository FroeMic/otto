export const JOB_TYPES = {
  applyTenantConfig: "apply_tenant_config",
  provisionTenantOpenAiKey: "provision_tenant_openai_key",
  refreshRuntimeImage: "refresh_runtime_image",
  syncTenantSessions: "sync_tenant_sessions",
} as const

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]
