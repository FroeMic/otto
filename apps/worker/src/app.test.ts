import assert from "node:assert/strict"

import { describe, expect, it, vi } from "vitest"

import { runWorkerLaneLoop, startWorker } from "./app"

describe("worker loop", () => {
  it("sleeps when a lane iteration processes no jobs", async () => {
    const sleepCalls: number[] = []
    let shouldContinue = true
    const runWorkerLaneIteration = vi.fn(async () => {
      shouldContinue = false
      return 0
    })

    await runWorkerLaneLoop("runtime", 250, {
      runWorkerLaneIteration,
      shouldContinue: () => shouldContinue,
      sleep: async (ms) => {
        sleepCalls.push(ms)
      },
    })

    expect(runWorkerLaneIteration).toHaveBeenCalledTimes(1)
    assert.deepEqual(sleepCalls, [250])
  })

  it("sleeps and retries after a lane failure", async () => {
    const sleepCalls: number[] = []
    let attempt = 0
    let shouldContinue = true

    await runWorkerLaneLoop("integrations", 400, {
      runWorkerLaneIteration: async () => {
        attempt += 1

        if (attempt === 1) {
          throw new Error("boom")
        }

        shouldContinue = false
        return 1
      },
      shouldContinue: () => shouldContinue,
      sleep: async (ms) => {
        sleepCalls.push(ms)
      },
    })

    assert.equal(attempt, 2)
    assert.deepEqual(sleepCalls, [400])
  })
})

describe("worker startup", () => {
  it("seeds scheduler jobs before starting all lane loops", async () => {
    const events: string[] = []
    const runWorkerLaneLoop = vi.fn(
      async (lane: string, pollIntervalMs: number) => {
        events.push(`loop:${lane}:${pollIntervalMs}`)
      },
    )

    await startWorker(
      {
        ensureWorkerSchedulerJobsSeeded: async () => {
          events.push("seed")
        },
        getEnv: () => ({
          WORKER_POLL_INTERVAL_MS: 125,
        }),
        getRuntimeSshAuthSource: () => "env",
        getWorkerLanes: () => ["runtime", "integrations"],
        runWorkerLaneIteration: async () => 0,
      },
      {
        runWorkerLaneLoop,
      },
    )

    assert.deepEqual(events, [
      "seed",
      "loop:runtime:125",
      "loop:integrations:125",
    ])
    expect(runWorkerLaneLoop).toHaveBeenCalledTimes(2)
  })
})
