import { JOB_TYPES, type JobType } from "./types";

export const JOB_LANES = {
  chat: "chat",
  runtime: "runtime",
  integrations: "integrations",
  metering: "metering",
  settlement: "settlement",
} as const;

export type JobLane = (typeof JOB_LANES)[keyof typeof JOB_LANES];

const JOB_TYPE_TO_LANE: Record<JobType, JobLane> = {
  [JOB_TYPES.provisionTenantServer]: JOB_LANES.runtime,
  [JOB_TYPES.provisionTenantServerFromSnapshot]: JOB_LANES.runtime,
  [JOB_TYPES.provisionTenantOpenAiKey]: JOB_LANES.runtime,
  [JOB_TYPES.applyTenantConfig]: JOB_LANES.runtime,
  [JOB_TYPES.refreshRuntimeImage]: JOB_LANES.runtime,
  [JOB_TYPES.runWorkspaceChatTurn]: JOB_LANES.chat,
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
const TENANT_MUTEX_GUARD_JOB_TYPES = [
  JOB_TYPES.provisionTenantServer,
  JOB_TYPES.provisionTenantServerFromSnapshot,
  JOB_TYPES.provisionTenantOpenAiKey,
  JOB_TYPES.applyTenantConfig,
  JOB_TYPES.refreshRuntimeImage,
  JOB_TYPES.whatsappLinkSession,
  JOB_TYPES.whatsappDisconnect,
] as const satisfies readonly JobType[];

export function getJobLane(jobType: JobType) {
  return JOB_TYPE_TO_LANE[jobType];
}

export function getJobTypesForLane(lane: JobLane): JobType[] {
  return ALL_JOB_TYPES.filter((jobType) => JOB_TYPE_TO_LANE[jobType] === lane);
}

export function laneUsesTenantMutex(lane: JobLane) {
  return getTenantMutexGuardJobTypesForLane(lane).length > 0;
}

export function getTenantMutexGuardJobTypesForLane(lane: JobLane): JobType[] {
  if (
    lane === JOB_LANES.chat ||
    lane === JOB_LANES.runtime ||
    lane === JOB_LANES.integrations
  ) {
    return [...TENANT_MUTEX_GUARD_JOB_TYPES];
  }

  return [];
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
