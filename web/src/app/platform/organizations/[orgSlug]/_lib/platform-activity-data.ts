import {
  formatSearchDateTime,
  type WorkspaceDateTimePreferences,
} from "@/lib/date-time";

export type PlatformActivityJobRow = {
  attempt: number;
  createdAt: Date;
  eventsCount: number;
  finishedAt: Date | null;
  id: string;
  jobType: string;
  searchText: string;
  startedAt: Date | null;
  status: string;
  step: string | null;
};

export type PlatformActivityEventRow = {
  createdAt: Date;
  eventType: string;
  id: string;
  jobRunId: string;
  jobStatus: string;
  jobType: string;
  message: string;
  searchText: string;
  step: string | null;
};

type PlatformActivityTenant = {
  recentEvents: Array<{
    createdAt: Date;
    eventType: string;
    jobRunId: string;
    jobStatus: string;
    jobType: string;
    message: string;
    step: string | null;
  }>;
  recentJobs: Array<{
    attempt: number;
    createdAt: Date;
    error: string | null;
    events: Array<{
      createdAt: Date;
      eventType: string;
      message: string;
    }>;
    finishedAt: Date | null;
    id: string;
    jobType: string;
    startedAt: Date | null;
    status: string;
    step: string | null;
  }>;
};

export function buildPlatformActivityData(
  tenant: PlatformActivityTenant,
  dateTimePreferences: WorkspaceDateTimePreferences,
) {
  return {
    events: tenant.recentEvents.map((event) => ({
      createdAt: event.createdAt,
      eventType: event.eventType,
      id: `${event.jobRunId}:${event.eventType}:${event.createdAt.toISOString()}`,
      jobRunId: event.jobRunId,
      jobStatus: event.jobStatus,
      jobType: event.jobType,
      message: event.message,
      searchText: [
        event.jobType,
        event.jobStatus,
        event.eventType,
        event.step ?? "",
        event.message,
        formatDateParts(event.createdAt, dateTimePreferences),
      ]
        .join(" ")
        .toLowerCase(),
      step: event.step,
    })),
    jobs: tenant.recentJobs.map((job) => ({
      attempt: job.attempt,
      createdAt: job.createdAt,
      eventsCount: job.events.length,
      finishedAt: job.finishedAt,
      id: job.id,
      jobType: job.jobType,
      searchText: [
        job.jobType,
        job.status,
        job.step ?? "",
        job.error ?? "",
        formatDateParts(job.startedAt ?? job.createdAt, dateTimePreferences),
        formatDateParts(job.finishedAt, dateTimePreferences),
      ]
        .join(" ")
        .toLowerCase(),
      startedAt: job.startedAt,
      status: job.status,
      step: job.step,
    })),
  };
}

function formatDateParts(
  value: Date | null,
  dateTimePreferences: WorkspaceDateTimePreferences,
) {
  if (!value) {
    return "";
  }

  return formatSearchDateTime(value, dateTimePreferences);
}
