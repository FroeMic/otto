import type { PlatformOrganizationDetail } from "@otto/feature-platform"

import {
  formatSearchDateTime,
  type PlatformDateTimePreferences,
} from "@/features/platform/date-time"

export interface PlatformActivityJobRow {
  attempt: number
  createdAt: string
  eventsCount: number
  finishedAt: string | null
  id: string
  jobType: string
  searchText: string
  startedAt: string | null
  status: string
  step: string | null
}

export interface PlatformActivityEventRow {
  createdAt: string
  eventType: string
  id: string
  jobRunId: string
  jobStatus: string
  jobType: string
  message: string
  searchText: string
  step: string | null
}

export function buildPlatformActivityData(
  organization: PlatformOrganizationDetail,
  dateTimePreferences: PlatformDateTimePreferences,
) {
  const tenant = organization.tenant

  if (!tenant) {
    return {
      events: [] as PlatformActivityEventRow[],
      jobs: [] as PlatformActivityJobRow[],
    }
  }

  return {
    events: tenant.recentEvents.map((event) => ({
      createdAt: event.createdAt,
      eventType: event.eventType,
      id: event.id,
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
        formatSearchDateTime(event.createdAt, dateTimePreferences),
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
        formatSearchDateTime(
          job.startedAt ?? job.createdAt,
          dateTimePreferences,
        ),
        formatSearchDateTime(job.finishedAt, dateTimePreferences),
      ]
        .join(" ")
        .toLowerCase(),
      startedAt: job.startedAt,
      status: job.status,
      step: job.step,
    })),
  }
}
