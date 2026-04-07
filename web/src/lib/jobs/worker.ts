import { getEnv } from "@/lib/env";

import { processApplyTenantConfigJob } from "./apply";
import {
  processExecuteBillingAutoTopOffJob,
  processScheduleBillingAutoTopOffEnqueueJob,
} from "./auto-top-off";
import {
  processScheduleCreditSettlementJob,
  processSettleCreditUsageChunkJob,
} from "./credit-burndown";
import {
  getRecurringSchedulerJobTypes,
  JOB_LANES,
  type JobLane,
} from "./lanes";
import {
  processScheduleOpenAiUsageSyncJob,
  processSyncOpenAiUsageTargetJob,
} from "./openai-usage";
import { processProvisionTenantOpenAiKeyJob } from "./provider-provisioning";
import { processProvisionTenantServerJob } from "./provisioning";
import {
  claimAvailableJobsForLane,
  enqueueJob,
  hasQueuedOrRunningJobOfType,
  markJobFailed,
} from "./queue";
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
    case JOB_TYPES.scheduleOpenAiUsageSync:
      await processScheduleOpenAiUsageSyncJob(job);
      return;
    case JOB_TYPES.syncOpenAiUsageTarget:
      await processSyncOpenAiUsageTargetJob(job);
      return;
    case JOB_TYPES.scheduleCreditSettlement:
      await processScheduleCreditSettlementJob(job);
      return;
    case JOB_TYPES.settleCreditUsageChunk:
      await processSettleCreditUsageChunkJob(job);
      return;
    case JOB_TYPES.scheduleBillingAutoTopOffEnqueue:
      await processScheduleBillingAutoTopOffEnqueueJob(job);
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

const WORKER_LANE_ORDER: JobLane[] = [
  JOB_LANES.runtime,
  JOB_LANES.integrations,
  JOB_LANES.metering,
  JOB_LANES.settlement,
];

const WORKER_LANE_CONCURRENCY: Record<JobLane, number> = {
  [JOB_LANES.runtime]: 2,
  [JOB_LANES.integrations]: 2,
  [JOB_LANES.metering]: 4,
  [JOB_LANES.settlement]: 2,
};

export function getWorkerLanes() {
  return WORKER_LANE_ORDER;
}

export async function ensureWorkerSchedulerJobsSeeded() {
  for (const jobType of getRecurringSchedulerJobTypes()) {
    if (await hasQueuedOrRunningJobOfType(jobType)) {
      continue;
    }

    await enqueueJob({
      jobType,
      payload: {},
    });
    console.info(`[worker] seeded recurring scheduler job ${jobType}`);
  }
}

export async function runWorkerLaneIteration(lane: JobLane): Promise<number> {
  const jobs = await claimAvailableJobsForLane({
    lane,
    limit: getLaneConcurrency(lane),
  });

  if (jobs.length === 0) {
    return 0;
  }

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      try {
        await processClaimedJob(job);
      } catch (error) {
        console.error(`[worker] job ${job.id} failed`, error);
      }
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`[worker] ${lane} lane execution failed`, result.reason);
    }
  }

  return jobs.length;
}

function getLaneConcurrency(lane: JobLane) {
  return Math.max(
    1,
    Math.min(getEnv().WORKER_BATCH_SIZE, WORKER_LANE_CONCURRENCY[lane]),
  );
}
