import { getEnv } from "@/lib/env";

import { claimAvailableJobs } from "./queue";
import type { ClaimedJob } from "./types";

export async function processClaimedJob(job: ClaimedJob): Promise<void> {
  console.info(`[worker] claimed job ${job.id} (${job.jobType})`);
}

export async function runWorkerIteration(): Promise<number> {
  const jobs = await claimAvailableJobs(getEnv().WORKER_BATCH_SIZE);

  for (const job of jobs) {
    await processClaimedJob(job);
  }

  return jobs.length;
}
