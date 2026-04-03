import { getEnv } from "@/lib/env";

import { processApplyTenantConfigJob } from "./apply";
import { processProvisionTenantServerJob } from "./provisioning";
import { claimAvailableJobs, markJobFailed } from "./queue";
import { processRefreshRuntimeImageJob } from "./runtime-operations";
import type { ClaimedJob } from "./types";
import { JOB_TYPES } from "./types";
import {
  processResyncSlackChannelsJob,
  processResyncSlackUsersJob,
} from "./slack-sync";
import {
  processWhatsAppDisconnectJob,
  processWhatsAppLinkSessionJob,
} from "./whatsapp";

export async function processClaimedJob(job: ClaimedJob): Promise<void> {
  console.info(`[worker] claimed job ${job.id} (${job.jobType})`);

  switch (job.jobType) {
    case JOB_TYPES.applyTenantConfig:
      await processApplyTenantConfigJob(job);
      return;
    case JOB_TYPES.refreshRuntimeImage:
      await processRefreshRuntimeImageJob(job);
      return;
    case JOB_TYPES.provisionTenantServer:
      await processProvisionTenantServerJob(job);
      return;
    case JOB_TYPES.whatsappLinkSession:
      await processWhatsAppLinkSessionJob(job);
      return;
    case JOB_TYPES.whatsappDisconnect:
      await processWhatsAppDisconnectJob(job);
      return;
    case JOB_TYPES.resyncSlackUsers:
      await processResyncSlackUsersJob(job);
      return;
    case JOB_TYPES.resyncSlackChannels:
      await processResyncSlackChannelsJob(job);
      return;
    default:
      await markJobFailed(job.id, `Unsupported job type: ${job.jobType}`);
      throw new Error(`Unsupported job type: ${job.jobType}`);
  }
}

export async function runWorkerIteration(): Promise<number> {
  const jobs = await claimAvailableJobs(getEnv().WORKER_BATCH_SIZE);

  if (jobs.length === 0) {
    console.info("[worker] no available jobs");
    return 0;
  }

  for (const job of jobs) {
    try {
      await processClaimedJob(job);
    } catch (error) {
      console.error(`[worker] job ${job.id} failed`, error);
    }
  }

  return jobs.length;
}
