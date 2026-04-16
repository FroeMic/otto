import type { WorkspaceChatMessagePart } from "@otto/feature-workspace-chat";
import type { ProviderUsageType } from "../providers/types";

export const JOB_TYPES = {
  bakeHetznerOnboardingSnapshot: "bake_hetzner_onboarding_snapshot",
  provisionTenantServer: "provision_tenant_server",
  provisionTenantServerFromSnapshot: "provision_tenant_server_from_snapshot",
  provisionTenantOpenAiKey: "provision_tenant_openai_key",
  applyTenantConfig: "apply_tenant_config",
  deleteWorkspace: "delete_workspace",
  refreshRuntimeImage: "refresh_runtime_image",
  runWorkspaceChatTurn: "run_workspace_chat_turn",
  scheduleOauthConnectionRefresh: "schedule_oauth_connection_refresh",
  refreshOauthConnection: "refresh_oauth_connection",
  scheduleOpenAiUsageSync: "schedule_openai_usage_sync",
  syncOpenAiUsageTarget: "sync_openai_usage_target",
  scheduleCreditSettlement: "schedule_credit_settlement",
  settleCreditUsageChunk: "settle_credit_usage_chunk",
  scheduleBillingAutoTopOffEnqueue: "schedule_billing_auto_top_off_enqueue",
  executeBillingAutoTopOff: "execute_billing_auto_top_off",
  reconcileTenantScheduledTasks: "reconcile_tenant_scheduled_tasks",
  whatsappLinkSession: "whatsapp_link_session",
  whatsappDisconnect: "whatsapp_disconnect",
  resyncSlackUsers: "resync_slack_users",
  resyncSlackChannels: "resync_slack_channels",
  syncTenantSessions: "sync_tenant_sessions",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export const JOB_STATUSES = {
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
} as const;

export type JobStatus = (typeof JOB_STATUSES)[keyof typeof JOB_STATUSES];

export const PROVISIONING_STEPS = {
  createServer: "create_server",
  waitForHetznerAction: "wait_for_hetzner_action",
  fetchServerIp: "fetch_server_ip",
  waitForSsh: "wait_for_ssh",
  waitForHostBootstrap: "wait_for_host_bootstrap",
  bootstrapRuntime: "bootstrap_runtime",
  startRuntime: "start_runtime",
  verifyRuntime: "verify_runtime",
  markServerReady: "mark_server_ready",
} as const;

export type ProvisioningStep =
  (typeof PROVISIONING_STEPS)[keyof typeof PROVISIONING_STEPS];

export const SNAPSHOT_PROVISIONING_STEPS = {
  createServerFromSnapshot: "create_server_from_snapshot",
  waitForHetznerAction: "wait_for_hetzner_action",
  fetchServerIp: "fetch_server_ip",
  waitForSsh: "wait_for_ssh",
  verifySnapshotHost: "verify_snapshot_host",
  bootstrapTenantRuntime: "bootstrap_tenant_runtime",
  startRuntime: "start_runtime",
  verifyRuntime: "verify_runtime",
  markServerReady: "mark_server_ready",
} as const;

export type SnapshotProvisioningStep =
  (typeof SNAPSHOT_PROVISIONING_STEPS)[keyof typeof SNAPSHOT_PROVISIONING_STEPS];

export const BAKE_ONBOARDING_SNAPSHOT_STEPS = {
  createServer: "create_server",
  waitForServerAction: "wait_for_server_action",
  fetchServerIp: "fetch_server_ip",
  waitForSsh: "wait_for_ssh",
  waitForHostBootstrap: "wait_for_host_bootstrap",
  prepareSnapshotHost: "prepare_snapshot_host",
  powerOffServer: "power_off_server",
  waitForPowerOff: "wait_for_power_off",
  createSnapshot: "create_snapshot",
} as const;

export type BakeOnboardingSnapshotStep =
  (typeof BAKE_ONBOARDING_SNAPSHOT_STEPS)[keyof typeof BAKE_ONBOARDING_SNAPSHOT_STEPS];

export const APPLY_STEPS = {
  loadingDesiredState: "loading_desired_state",
  renderingFiles: "rendering_files",
  writingFiles: "writing_files",
  pullingRuntimeImage: "pulling_runtime_image",
  restartingRuntime: "restarting_runtime",
  verifyingRuntime: "verifying_runtime",
  succeeded: "succeeded",
  failed: "failed",
} as const;

export type ApplyStep = (typeof APPLY_STEPS)[keyof typeof APPLY_STEPS];

export type ProvisionTenantServerPayload = {
  tenantId: string;
  step?: ProvisioningStep;
  providerServerId?: string;
  actionId?: string;
  ipv4?: string;
};

export type ProvisionTenantServerFromSnapshotPayload = {
  tenantId: string;
  step?: SnapshotProvisioningStep;
  providerServerId?: string;
  actionId?: string;
  ipv4?: string;
  sourceSnapshotId?: string;
  snapshotHostVerifyStartedAt?: string;
};

export type BakeHetznerOnboardingSnapshotPayload = {
  organizationId?: string;
  organizationSlug?: string;
  generation: string;
  baseImage: string;
  runtimeImage: string;
  step?: BakeOnboardingSnapshotStep;
  providerServerId?: string;
  actionId?: string;
  ipv4?: string;
};

export type ProvisionTenantOpenAiKeyPayload = {
  tenantId: string;
};

export type ApplyTenantConfigPayload = {
  tenantId: string;
  desiredStateVersion: number;
  managedSkillRenameOperations?: Array<{
    fromSkillKey: string;
    toSkillKey: string;
  }>;
  managedSkillResetOperations?: Array<{
    scope: "companion_files";
    skillKey: string;
  }>;
  pullImageFirst?: boolean;
  step?: ApplyStep;
};

export type RefreshRuntimeImagePayload = {
  tenantId: string;
};

export type DeleteWorkspacePayload = {
  organizationId: string;
  organizationSlug: string;
  organizationExternalId: string;
};

export type RunWorkspaceChatTurnPayload = {
  assistantMessageId?: string;
  conversationKind: "ad_hoc" | "durable_named" | "external_surface";
  conversationId: string;
  conversationTitle: string;
  conversationVisibility: "open" | "personal";
  parts: WorkspaceChatMessagePart[];
  senderDisplayName: string;
  senderExternalId: string;
  tenantId: string;
  userMessageId: string;
};

export type ScheduleOauthConnectionRefreshPayload = Record<string, never>;

export type RefreshOauthConnectionPayload = {
  connectionId: string;
  tenantId: string;
};

export type ScheduleOpenAiUsageSyncPayload = Record<string, never>;

export type SyncOpenAiUsageTargetPayload = {
  providerAccountId: string;
  usageType: ProviderUsageType;
};

export type ScheduleCreditSettlementPayload = Record<string, never>;

export type SettleCreditUsageChunkPayload = {
  bucketIds: string[];
};

export type ScheduleBillingAutoTopOffEnqueuePayload = Record<string, never>;

export type ExecuteBillingAutoTopOffPayload = {
  organizationId: string;
  tenantId: string;
};

export type ReconcileTenantScheduledTasksPayload = {
  tenantId: string;
};

export type WhatsAppLinkSessionPayload = {
  linkSessionId: string;
  tenantId: string;
};

export type WhatsAppDisconnectPayload = {
  desiredStateVersion?: number;
  tenantId: string;
};

export type ResyncSlackUsersPayload = {
  tenantId: string;
};

export type ResyncSlackChannelsPayload = {
  tenantId: string;
};

export type SyncTenantSessionsPayload = {
  tenantId: string;
};

export type ControlPlaneJobPayload =
  | {
      jobType: typeof JOB_TYPES.bakeHetznerOnboardingSnapshot;
      payload: BakeHetznerOnboardingSnapshotPayload;
    }
  | {
      jobType: typeof JOB_TYPES.provisionTenantServer;
      payload: ProvisionTenantServerPayload;
    }
  | {
      jobType: typeof JOB_TYPES.provisionTenantServerFromSnapshot;
      payload: ProvisionTenantServerFromSnapshotPayload;
    }
  | {
      jobType: typeof JOB_TYPES.provisionTenantOpenAiKey;
      payload: ProvisionTenantOpenAiKeyPayload;
    }
  | {
      jobType: typeof JOB_TYPES.applyTenantConfig;
      payload: ApplyTenantConfigPayload;
    }
  | {
      jobType: typeof JOB_TYPES.deleteWorkspace;
      payload: DeleteWorkspacePayload;
    }
  | {
      jobType: typeof JOB_TYPES.refreshRuntimeImage;
      payload: RefreshRuntimeImagePayload;
    }
  | {
      jobType: typeof JOB_TYPES.runWorkspaceChatTurn;
      payload: RunWorkspaceChatTurnPayload;
    }
  | {
      jobType: typeof JOB_TYPES.scheduleOauthConnectionRefresh;
      payload: ScheduleOauthConnectionRefreshPayload;
    }
  | {
      jobType: typeof JOB_TYPES.refreshOauthConnection;
      payload: RefreshOauthConnectionPayload;
    }
  | {
      jobType: typeof JOB_TYPES.scheduleOpenAiUsageSync;
      payload: ScheduleOpenAiUsageSyncPayload;
    }
  | {
      jobType: typeof JOB_TYPES.syncOpenAiUsageTarget;
      payload: SyncOpenAiUsageTargetPayload;
    }
  | {
      jobType: typeof JOB_TYPES.scheduleCreditSettlement;
      payload: ScheduleCreditSettlementPayload;
    }
  | {
      jobType: typeof JOB_TYPES.settleCreditUsageChunk;
      payload: SettleCreditUsageChunkPayload;
    }
  | {
      jobType: typeof JOB_TYPES.scheduleBillingAutoTopOffEnqueue;
      payload: ScheduleBillingAutoTopOffEnqueuePayload;
    }
  | {
      jobType: typeof JOB_TYPES.executeBillingAutoTopOff;
      payload: ExecuteBillingAutoTopOffPayload;
    }
  | {
      jobType: typeof JOB_TYPES.reconcileTenantScheduledTasks;
      payload: ReconcileTenantScheduledTasksPayload;
    }
  | {
      jobType: typeof JOB_TYPES.whatsappLinkSession;
      payload: WhatsAppLinkSessionPayload;
    }
  | {
      jobType: typeof JOB_TYPES.whatsappDisconnect;
      payload: WhatsAppDisconnectPayload;
    }
  | {
      jobType: typeof JOB_TYPES.resyncSlackUsers;
      payload: ResyncSlackUsersPayload;
    }
  | {
      jobType: typeof JOB_TYPES.resyncSlackChannels;
      payload: ResyncSlackChannelsPayload;
    }
  | {
      jobType: typeof JOB_TYPES.syncTenantSessions;
      payload: SyncTenantSessionsPayload;
    };

export type ClaimedJob = {
  id: string;
  jobType: JobType;
  tenantId: string | null;
  attempt: number;
  payload: Record<string, unknown>;
};
