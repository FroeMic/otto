import { getEnv, getRuntimeSshAuthSource } from "../lib/env";
import type { JobLane } from "../lib/jobs/lanes";
import {
  ensureWorkerSchedulerJobsSeeded,
  getWorkerLanes,
  runWorkerLaneIteration,
} from "../lib/jobs/worker";

async function main() {
  const env = getEnv();

  console.info("[worker] starting control-plane worker");
  console.info(
    `[worker] runtime SSH auth source: ${getRuntimeSshAuthSource()}`,
  );

  await ensureWorkerSchedulerJobsSeeded();

  await Promise.all(
    getWorkerLanes().map((lane) =>
      runWorkerLaneLoop(lane, env.WORKER_POLL_INTERVAL_MS),
    ),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorkerLaneLoop(lane: JobLane, pollIntervalMs: number) {
  while (true) {
    try {
      const processedCount = await runWorkerLaneIteration(lane);

      if (processedCount === 0) {
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      console.error(`[worker] ${lane} lane failed`, error);
      await sleep(pollIntervalMs);
    }
  }
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
