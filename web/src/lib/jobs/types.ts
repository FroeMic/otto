export const JOB_TYPES = {
  provisionTenantServer: "provision_tenant_server",
  applyTenantConfig: "apply_tenant_config",
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
  bootstrapRuntime: "bootstrap_runtime",
  markServerReady: "mark_server_ready",
} as const;

export type ProvisioningStep =
  (typeof PROVISIONING_STEPS)[keyof typeof PROVISIONING_STEPS];

export const APPLY_STEPS = {
  compileDesiredState: "compile_desired_state",
  uploadRuntimeFiles: "upload_runtime_files",
  restartRuntime: "restart_runtime",
  verifyRuntime: "verify_runtime",
  markApplyComplete: "mark_apply_complete",
} as const;

export type ApplyStep = (typeof APPLY_STEPS)[keyof typeof APPLY_STEPS];

export type ProvisionTenantServerPayload = {
  tenantId: string;
  step?: ProvisioningStep;
  providerServerId?: string;
  actionId?: string;
  ipv4?: string;
};

export type ApplyTenantConfigPayload = {
  tenantId: string;
  desiredStateVersion: number;
  step?: ApplyStep;
};

export type OttoJobPayload =
  | {
      jobType: typeof JOB_TYPES.provisionTenantServer;
      payload: ProvisionTenantServerPayload;
    }
  | {
      jobType: typeof JOB_TYPES.applyTenantConfig;
      payload: ApplyTenantConfigPayload;
    };

export type ClaimedJob = {
  id: string;
  jobType: JobType;
  tenantId: string | null;
  attempt: number;
  payload: Record<string, unknown>;
};
