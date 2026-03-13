import type { ClaimedJob, OttoJobPayload } from "./types";

export async function enqueueJob(_job: OttoJobPayload): Promise<string> {
  throw new Error("enqueueJob is not implemented yet");
}

export async function claimAvailableJobs(
  _limit: number,
): Promise<ClaimedJob[]> {
  return [];
}

export async function markJobSucceeded(
  _jobId: string,
  _result?: Record<string, unknown>,
): Promise<void> {
  throw new Error("markJobSucceeded is not implemented yet");
}

export async function markJobFailed(
  _jobId: string,
  _error: string,
  _retryAt?: Date,
): Promise<void> {
  throw new Error("markJobFailed is not implemented yet");
}

export async function appendJobEvent(
  _jobId: string,
  _eventType: string,
  _message: string,
  _data?: Record<string, unknown>,
): Promise<void> {
  throw new Error("appendJobEvent is not implemented yet");
}
