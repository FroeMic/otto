import assert from "node:assert/strict";
import test from "node:test";

import { JOB_LANES } from "./lanes";
import { runWorkerLaneIterationWithDependencies } from "./worker";

test("reclaims stale jobs before claiming more lane work", async () => {
  const calls: Array<{
    fn: string;
    input: unknown;
  }> = [];

  const processedCount = await runWorkerLaneIterationWithDependencies(
    JOB_LANES.runtime,
    {
      claimAvailableJobsForLane: async (input) => {
        calls.push({
          fn: "claim",
          input,
        });
        return [];
      },
      getLaneConcurrency: () => 2,
      processClaimedJob: async () => {
        throw new Error("No jobs should have been processed.");
      },
      reclaimStaleRunningJobsForLane: async (input) => {
        calls.push({
          fn: "reclaim",
          input,
        });
        return 1;
      },
    },
  );

  assert.equal(processedCount, 0);
  assert.deepEqual(calls, [
    {
      fn: "reclaim",
      input: {
        lane: JOB_LANES.runtime,
      },
    },
    {
      fn: "claim",
      input: {
        lane: JOB_LANES.runtime,
        limit: 2,
      },
    },
  ]);
});
