import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { jobEvents, jobRuns } from "@/db/schema";

import type { ClaimedJob, OttoJobPayload } from "./types";
import { JOB_STATUSES } from "./types";

export async function enqueueJob(job: OttoJobPayload): Promise<string> {
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

export async function claimAvailableJobs(
  _limit: number,
): Promise<ClaimedJob[]> {
  return [];
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
