import { JOB_TYPES, type JobType } from "./types";

const APPLY_CONFIG_STALE_TIMEOUT_MS = 60_000;
const APPLY_PULL_IMAGE_STALE_TIMEOUT_MS = 180_000;

export function getJobStaleTimeoutMs(
  job: {
    jobType: JobType;
    payload: Record<string, unknown>;
  },
  defaultTimeoutMs: number,
) {
  if (job.jobType === JOB_TYPES.applyTenantConfig) {
    return job.payload.pullImageFirst === true
      ? APPLY_PULL_IMAGE_STALE_TIMEOUT_MS
      : APPLY_CONFIG_STALE_TIMEOUT_MS;
  }

  return defaultTimeoutMs;
}
