export const JOB_TYPES = {
  syncTenantSessions: "sync_tenant_sessions",
} as const

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]
