import { JOB_TYPES, type JobType } from "./types";

export const JOB_LANES = {
  runtime: "runtime",
  integrations: "integrations",
  metering: "metering",
  settlement: "settlement",
} as const;

export type JobLane = (typeof JOB_LANES)[keyof typeof JOB_LANES];

const JOB_TYPE_TO_LANE: Record<JobType, JobLane> = {
  [JOB_TYPES.provisionTenantServer]: JOB_LANES.runtime,
  [JOB_TYPES.provisionTenantOpenAiKey]: JOB_LANES.runtime,
  [JOB_TYPES.applyTenantConfig]: JOB_LANES.runtime,
  [JOB_TYPES.refreshRuntimeImage]: JOB_LANES.runtime,
  [JOB_TYPES.whatsappLinkSession]: JOB_LANES.runtime,
  [JOB_TYPES.whatsappDisconnect]: JOB_LANES.runtime,
  [JOB_TYPES.scheduleOauthConnectionRefresh]: JOB_LANES.integrations,
  [JOB_TYPES.refreshOauthConnection]: JOB_LANES.integrations,
  [JOB_TYPES.resyncSlackUsers]: JOB_LANES.integrations,
  [JOB_TYPES.resyncSlackChannels]: JOB_LANES.integrations,
  [JOB_TYPES.reconcileTenantScheduledTasks]: JOB_LANES.integrations,
  [JOB_TYPES.syncTenantSessions]: JOB_LANES.integrations,
  [JOB_TYPES.scheduleOpenAiUsageSync]: JOB_LANES.metering,
  [JOB_TYPES.syncOpenAiUsageTarget]: JOB_LANES.metering,
  [JOB_TYPES.scheduleCreditSettlement]: JOB_LANES.settlement,
  [JOB_TYPES.settleCreditUsageChunk]: JOB_LANES.settlement,
  [JOB_TYPES.scheduleBillingAutoTopOffEnqueue]: JOB_LANES.settlement,
  [JOB_TYPES.executeBillingAutoTopOff]: JOB_LANES.settlement,
};

const ALL_JOB_TYPES = Object.values(JOB_TYPES);
const TENANT_MUTEX_LANES = new Set<JobLane>([
  JOB_LANES.runtime,
  JOB_LANES.integrations,
]);

export function getJobLane(jobType: JobType) {
  return JOB_TYPE_TO_LANE[jobType];
}

export function getJobTypesForLane(lane: JobLane): JobType[] {
  return ALL_JOB_TYPES.filter((jobType) => JOB_TYPE_TO_LANE[jobType] === lane);
}

export function laneUsesTenantMutex(lane: JobLane) {
  return TENANT_MUTEX_LANES.has(lane);
}

export function getTenantMutexJobTypes(): JobType[] {
  return ALL_JOB_TYPES.filter((jobType) =>
    TENANT_MUTEX_LANES.has(JOB_TYPE_TO_LANE[jobType]),
  );
}

export function getRecurringSchedulerJobTypes(): RecurringSchedulerJobType[] {
  return [
    JOB_TYPES.scheduleOauthConnectionRefresh,
    JOB_TYPES.scheduleOpenAiUsageSync,
    JOB_TYPES.scheduleCreditSettlement,
    JOB_TYPES.scheduleBillingAutoTopOffEnqueue,
  ];
}
export type RecurringSchedulerJobType =
  | typeof JOB_TYPES.scheduleOauthConnectionRefresh
  | typeof JOB_TYPES.scheduleOpenAiUsageSync
  | typeof JOB_TYPES.scheduleCreditSettlement
  | typeof JOB_TYPES.scheduleBillingAutoTopOffEnqueue;
