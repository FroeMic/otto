import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { jobEvents, jobRuns } from "@/db/schema";

import type { ClaimedJob, ControlPlaneJobPayload } from "./types";
import { JOB_STATUSES } from "./types";

export async function enqueueJob(job: ControlPlaneJobPayload): Promise<string> {
  const db = getDb();

  const [createdJob] = await db
    .insert(jobRuns)
    .values({
      jobType: job.jobType,
      tenantId: job.payload.tenantId,
      status: JOB_STATUSES.queued,
      payloadJson: job.payload,
      availableAt: new Date(),
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
  const db = getDb();
  const claimedJobs = await db.execute<{
    attempt: number;
    id: string;
    jobType: string;
    payload: Record<string, unknown>;
    tenantId: string | null;
  }>(sql`
    with claimed as (
      select ${jobRuns.id}
      from ${jobRuns}
      where ${jobRuns.status} = ${JOB_STATUSES.queued}
        and ${jobRuns.availableAt} <= now()
      order by ${jobRuns.availableAt} asc, ${jobRuns.createdAt} asc
      limit ${limit}
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
  `);

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
