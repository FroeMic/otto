export const JOB_TYPES = {
  applyTenantConfig: "apply_tenant_config",
  provisionTenantOpenAiKey: "provision_tenant_openai_key",
  reconcileTenantScheduledTasks: "reconcile_tenant_scheduled_tasks",
  refreshRuntimeImage: "refresh_runtime_image",
  runWorkspaceChatTurn: "run_workspace_chat_turn",
  resyncSlackChannels: "resync_slack_channels",
  resyncSlackUsers: "resync_slack_users",
  syncTenantSessions: "sync_tenant_sessions",
} as const

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]
