import assert from "node:assert/strict"

import { describe, expect, it, vi } from "vitest"

import { runWorkerLaneLoop, runWorkerLaneSlotLoop, startWorker } from "./app"

describe("worker loop", () => {
  it("reclaims stale jobs before claiming new work", async () => {
    const events: string[] = []
    let shouldContinue = true

    await runWorkerLaneSlotLoop("runtime", 0, 250, {
      claimAvailableJobsForLane: async ({ limit, lane }) => {
        events.push(`claim:${lane}:${limit}`)
        shouldContinue = false
        return []
      },
      processClaimedJob: async () => {
        events.push("process")
      },
      reclaimStaleRunningJobsForLane: async ({ lane }) => {
        events.push(`reclaim:${lane}`)
        return 0
      },
      shouldContinue: () => shouldContinue,
      sleep: async (ms) => {
        events.push(`sleep:${ms}`)
      },
    })

    assert.deepEqual(events, [
      "reclaim:runtime",
      "claim:runtime:1",
      "sleep:250",
    ])
  })

  it("sleeps when a lane iteration processes no jobs", async () => {
    const sleepCalls: number[] = []
    let shouldContinue = true
    const claimAvailableJobsForLane = vi.fn(async () => {
      shouldContinue = false
      return []
    })

    await runWorkerLaneLoop("runtime", 250, {
      claimAvailableJobsForLane,
      processClaimedJob: async () => {},
      reclaimStaleRunningJobsForLane: async () => 0,
      shouldContinue: () => shouldContinue,
      sleep: async (ms) => {
        sleepCalls.push(ms)
      },
    })

    expect(claimAvailableJobsForLane).toHaveBeenCalledTimes(1)
    assert.deepEqual(sleepCalls, [250])
  })

  it("sleeps and retries after a lane failure", async () => {
    const sleepCalls: number[] = []
    let attempt = 0
    let shouldContinue = true

    await runWorkerLaneLoop("integrations", 400, {
      claimAvailableJobsForLane: async () => {
        attempt += 1

        if (attempt === 1) {
          throw new Error("boom")
        }

        shouldContinue = false
        return []
      },
      processClaimedJob: async () => {},
      reclaimStaleRunningJobsForLane: async () => 0,
      shouldContinue: () => shouldContinue,
      sleep: async (ms) => {
        sleepCalls.push(ms)
      },
    })

    assert.equal(attempt, 2)
    assert.deepEqual(sleepCalls, [400, 400])
  })

  it("logs brief OpenAI admin 5xx lane failures without passing Bun the raw error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    let shouldContinue = true

    try {
      await runWorkerLaneLoop("metering", 400, {
        claimAvailableJobsForLane: async () => {
          shouldContinue = false
          throw new Error(
            "OpenAI admin API request failed (504): api.openai.com | 504: Gateway time-out",
          )
        },
        processClaimedJob: async () => {},
        reclaimStaleRunningJobsForLane: async () => 0,
        shouldContinue: () => shouldContinue,
        sleep: async () => {},
      })
      expect(errorSpy).toHaveBeenCalledWith(
        "[worker] metering lane failed: OpenAI admin API transient upstream error (504)",
      )
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe("worker startup", () => {
  it("seeds scheduler jobs before starting all lane loops", async () => {
    const events: string[] = []
    const runWorkerLaneSlotLoop = vi.fn(
      async (lane: string, _slotIndex: number, pollIntervalMs: number) => {
        events.push(`loop:${lane}:${pollIntervalMs}`)
      },
    )

    await startWorker(
      {
        claimAvailableJobsForLane: async () => [],
        ensureWorkerSchedulerJobsSeeded: async () => {
          events.push("seed")
        },
        getEnv: () => ({
          WORKER_POLL_INTERVAL_MS: 125,
        }),
        getLaneConcurrency: () => 1,
        getRuntimeSshAuthSource: () => "env",
        getWorkerLanes: () => ["runtime", "integrations"],
        processClaimedJob: async () => {},
        reclaimStaleRunningJobsForLane: async () => 0,
      },
      {
        runWorkerLaneSlotLoop,
      },
    )

    assert.deepEqual(events, [
      "seed",
      "loop:runtime:125",
      "loop:integrations:125",
    ])
    expect(runWorkerLaneSlotLoop).toHaveBeenCalledTimes(2)
  })

  it("starts one slot loop per lane concurrency so one hung slot does not block the whole lane", async () => {
    const events: string[] = []
    const blockers = new Map<string, () => void>()

    const startPromise = startWorker(
      {
        claimAvailableJobsForLane: async () => [],
        ensureWorkerSchedulerJobsSeeded: async () => {
          events.push("seed")
        },
        getEnv: () => ({
          WORKER_POLL_INTERVAL_MS: 125,
        }),
        getLaneConcurrency: (lane) => (lane === "runtime" ? 2 : 1),
        getRuntimeSshAuthSource: () => "env",
        getWorkerLanes: () => ["runtime", "integrations"],
        processClaimedJob: async () => {},
        reclaimStaleRunningJobsForLane: async () => 0,
      },
      {
        runWorkerLaneSlotLoop: async (
          lane: string,
          slotIndex: number,
          pollIntervalMs: number,
        ) => {
          events.push(`loop:${lane}:${slotIndex}:${pollIntervalMs}`)

          await new Promise<void>((resolve) => {
            blockers.set(`${lane}:${slotIndex}`, resolve)
          })
        },
      },
    )

    await vi.waitFor(() => {
      assert.deepEqual(events, [
        "seed",
        "loop:runtime:0:125",
        "loop:runtime:1:125",
        "loop:integrations:0:125",
      ])
    })

    for (const resolve of blockers.values()) {
      resolve()
    }

    await startPromise
  })
})
