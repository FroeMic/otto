import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { jobEvents, jobRuns } from "@/db/schema";

import {
  getJobTypesForLane,
  getTenantMutexJobTypes,
  type JobLane,
  laneUsesTenantMutex,
} from "./lanes";
import type { ClaimedJob, ControlPlaneJobPayload } from "./types";
import { JOB_STATUSES } from "./types";

export async function enqueueJob(
  job: ControlPlaneJobPayload,
  options?: {
    availableAt?: Date;
  },
): Promise<string> {
  const db = getDb();
  const tenantId =
    "tenantId" in job.payload && typeof job.payload.tenantId === "string"
      ? job.payload.tenantId
      : null;

  const [createdJob] = await db
    .insert(jobRuns)
    .values({
      availableAt: options?.availableAt ?? new Date(),
      jobType: job.jobType,
      tenantId,
      status: JOB_STATUSES.queued,
      payloadJson: job.payload,
    })
    .returning({
      id: jobRuns.id,
    });

  await appendJobEvent(
    createdJob.id,
    JOB_STATUSES.queued,
    "Job queued for execution",
    { jobType: job.jobType },
  );

  return createdJob.id;
}

export async function claimAvailableJobs(limit: number): Promise<ClaimedJob[]> {
  return claimJobs({
    jobTypes: null,
    limit,
    useTenantMutex: false,
  });
}

export async function claimAvailableJobsForLane(input: {
  lane: JobLane;
  limit: number;
}): Promise<ClaimedJob[]> {
  return claimJobs({
    jobTypes: getJobTypesForLane(input.lane),
    limit: input.limit,
    useTenantMutex: laneUsesTenantMutex(input.lane),
  });
}

export async function listQueuedOrRunningJobsByType(jobType: string) {
  const db = getDb();

  const jobs = await db
    .select({
      id: jobRuns.id,
      payload: jobRuns.payloadJson,
      status: jobRuns.status,
      tenantId: jobRuns.tenantId,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobType, jobType),
        inArray(jobRuns.status, [JOB_STATUSES.queued, JOB_STATUSES.running]),
      ),
    );

  return jobs.map((job) => ({
    ...job,
    payload: parsePayload(job.payload),
  }));
}

export async function hasQueuedOrRunningJobOfType(jobType: string) {
  const [job] = await listQueuedOrRunningJobsByType(jobType);
  return Boolean(job);
}

async function claimJobs(input: {
  jobTypes: string[] | null;
  limit: number;
  useTenantMutex: boolean;
}): Promise<ClaimedJob[]> {
  if (input.limit <= 0) {
    return [];
  }

  const db = getDb();
  const laneJobTypesSql = input.jobTypes
    ? sql.join(
        input.jobTypes.map((jobType) => sql`${jobType}`),
        sql`, `,
      )
    : null;
  const tenantMutexJobTypes = getTenantMutexJobTypes();
  const tenantMutexJobTypesSql = sql.join(
    tenantMutexJobTypes.map((jobType) => sql`${jobType}`),
    sql`, `,
  );
  const claimedJobs = await db.execute<{
    attempt: number;
    id: string;
    jobType: string;
    payload: Record<string, unknown>;
    tenantId: string | null;
  }>(
    input.useTenantMutex
      ? sql`
          with running_tenants as (
            select distinct ${jobRuns.tenantId} as tenant_id
            from ${jobRuns}
            where ${jobRuns.status} = ${JOB_STATUSES.running}
              and ${jobRuns.tenantId} is not null
              and ${jobRuns.jobType} in (${tenantMutexJobTypesSql})
          ),
          candidates as (
            select
              ${jobRuns.id} as id,
              ${jobRuns.availableAt} as available_at,
              ${jobRuns.createdAt} as created_at,
              row_number() over (
                partition by case
                  when ${jobRuns.tenantId} is null then ${jobRuns.id}::text
                  else ${jobRuns.tenantId}::text
                end
                order by ${jobRuns.availableAt} asc, ${jobRuns.createdAt} asc
              ) as tenant_rank
            from ${jobRuns}
            where ${jobRuns.status} = ${JOB_STATUSES.queued}
              and ${jobRuns.availableAt} <= now()
              and ${jobRuns.jobType} in (${laneJobTypesSql})
              and (
                ${jobRuns.tenantId} is null
                or ${jobRuns.tenantId} not in (
                  select tenant_id from running_tenants
                )
              )
            order by ${jobRuns.availableAt} asc, ${jobRuns.createdAt} asc
            for update skip locked
          ),
          claimed as (
            select id
            from candidates
            where tenant_rank = 1
            order by available_at asc, created_at asc
            limit ${input.limit}
          )
          update ${jobRuns}
          set
            status = ${JOB_STATUSES.running},
            attempt = ${jobRuns.attempt} + 1,
            started_at = now(),
            updated_at = now(),
            error = null
          where ${jobRuns.id} in (select id from claimed)
          returning
            ${jobRuns.id} as id,
            ${jobRuns.jobType} as "jobType",
            ${jobRuns.tenantId} as "tenantId",
            ${jobRuns.attempt} as attempt,
            ${jobRuns.payloadJson} as payload
        `
      : sql`
          with claimed as (
            select ${jobRuns.id}
            from ${jobRuns}
            where ${jobRuns.status} = ${JOB_STATUSES.queued}
              and ${jobRuns.availableAt} <= now()
              ${laneJobTypesSql ? sql`and ${jobRuns.jobType} in (${laneJobTypesSql})` : sql``}
            order by ${jobRuns.availableAt} asc, ${jobRuns.createdAt} asc
            limit ${input.limit}
            for update skip locked
          )
          update ${jobRuns}
          set
            status = ${JOB_STATUSES.running},
            attempt = ${jobRuns.attempt} + 1,
            started_at = now(),
            updated_at = now(),
            error = null
          where ${jobRuns.id} in (select id from claimed)
          returning
            ${jobRuns.id} as id,
            ${jobRuns.jobType} as "jobType",
            ${jobRuns.tenantId} as "tenantId",
            ${jobRuns.attempt} as attempt,
            ${jobRuns.payloadJson} as payload
        `,
  );

  const jobs = claimedJobs.map((job) => ({
    attempt: job.attempt,
    id: job.id,
    jobType: job.jobType as ClaimedJob["jobType"],
    payload: parsePayload(job.payload),
    tenantId: job.tenantId,
  }));

  await Promise.all(
    jobs.map((job) =>
      appendJobEvent(job.id, JOB_STATUSES.running, "Job claimed by worker", {
        attempt: job.attempt,
      }),
    ),
  );

  return jobs;
}

export async function markJobSucceeded(
  jobId: string,
  result?: Record<string, unknown>,
): Promise<void> {
  const db = getDb();

  await db
    .update(jobRuns)
    .set({
      status: JOB_STATUSES.succeeded,
      resultJson: result,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function markJobFailed(
  jobId: string,
  error: string,
  retryAt?: Date,
): Promise<void> {
  const db = getDb();
  const shouldRetry = Boolean(retryAt);

  await db
    .update(jobRuns)
    .set({
      status: shouldRetry ? JOB_STATUSES.queued : JOB_STATUSES.failed,
      error,
      availableAt: retryAt ?? new Date(),
      finishedAt: shouldRetry ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function requeueJob(
  jobId: string,
  payload: Record<string, unknown>,
  availableAt: Date,
): Promise<void> {
  const db = getDb();

  await db
    .update(jobRuns)
    .set({
      availableAt,
      error: null,
      payloadJson: payload,
      status: JOB_STATUSES.queued,
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function appendJobEvent(
  jobId: string,
  eventType: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const db = getDb();

  await db.insert(jobEvents).values({
    jobRunId: jobId,
    eventType,
    message,
    dataJson: data,
  });
}

function parsePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}
