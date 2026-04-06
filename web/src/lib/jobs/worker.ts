import { getEnv } from "@/lib/env";

import { processApplyTenantConfigJob } from "./apply";
import {
  processExecuteBillingAutoTopOffJob,
  runAutoTopOffEnqueueCycle,
} from "./auto-top-off";
import { runCreditBurndownSettlementCycle } from "./credit-burndown";
import { runOpenAiUsageIngestionCycle } from "./openai-usage";
import { processProvisionTenantOpenAiKeyJob } from "./provider-provisioning";
import { processProvisionTenantServerJob } from "./provisioning";
import { claimAvailableJobs, markJobFailed } from "./queue";
import { processRefreshRuntimeImageJob } from "./runtime-operations";
import { processReconcileTenantScheduledTasksJob } from "./scheduled-tasks-sync";
import { processSyncTenantSessionsJob } from "./sessions-sync";
import {
  processResyncSlackChannelsJob,
  processResyncSlackUsersJob,
} from "./slack-sync";
import type { ClaimedJob } from "./types";
import { JOB_TYPES } from "./types";
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
    case JOB_TYPES.provisionTenantOpenAiKey:
      await processProvisionTenantOpenAiKeyJob(job);
      return;
    case JOB_TYPES.refreshRuntimeImage:
      await processRefreshRuntimeImageJob(job);
      return;
    case JOB_TYPES.executeBillingAutoTopOff:
      await processExecuteBillingAutoTopOffJob(job);
      return;
    case JOB_TYPES.reconcileTenantScheduledTasks:
      await processReconcileTenantScheduledTasksJob(job);
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
    case JOB_TYPES.syncTenantSessions:
      await processSyncTenantSessionsJob(job);
      return;
    default:
      await markJobFailed(job.id, `Unsupported job type: ${job.jobType}`);
      throw new Error(`Unsupported job type: ${job.jobType}`);
  }
}

export async function runWorkerIteration(): Promise<number> {
  const syncedUsageTargets = await runMaintenanceStep(
    "OpenAI usage ingestion",
    runOpenAiUsageIngestionCycle,
  );
  const settledUsageBuckets = await runMaintenanceStep(
    "credit burndown settlement",
    runCreditBurndownSettlementCycle,
  );
  const queuedAutoTopOffJobs = await runMaintenanceStep(
    "billing auto-top-off enqueue",
    runAutoTopOffEnqueueCycle,
  );
  const jobs = await claimAvailableJobs(getEnv().WORKER_BATCH_SIZE);

  if (jobs.length === 0) {
    console.info("[worker] no available jobs");
    return syncedUsageTargets + settledUsageBuckets + queuedAutoTopOffJobs;
  }

  for (const job of jobs) {
    try {
      await processClaimedJob(job);
    } catch (error) {
      console.error(`[worker] job ${job.id} failed`, error);
    }
  }

  return (
    jobs.length +
    syncedUsageTargets +
    settledUsageBuckets +
    queuedAutoTopOffJobs
  );
}

async function runMaintenanceStep(
  label: string,
  runStep: () => Promise<number>,
) {
  try {
    return await runStep();
  } catch (error) {
    const message =
      error instanceof Error && error.message.length > 0
        ? error.message
        : "Unknown worker maintenance error";
    console.error(`[worker] ${label} failed: ${message}`);
    return 0;
  }
}
