type WorkerLane = string

type ClaimedJob = {
  id: string
}

type WorkerEnv = {
  WORKER_POLL_INTERVAL_MS: number
}

type WorkerRuntime = {
  claimAvailableJobsForLane: (input: {
    lane: WorkerLane
    limit: number
  }) => Promise<ClaimedJob[]>
  ensureWorkerSchedulerJobsSeeded: () => Promise<void>
  getEnv: () => WorkerEnv
  getLaneConcurrency: (lane: WorkerLane) => number
  getRuntimeSshAuthSource: () => string
  getWorkerLanes: () => WorkerLane[]
  processClaimedJob: (job: ClaimedJob) => Promise<void>
  reclaimStaleRunningJobsForLane: (input: {
    lane: WorkerLane
  }) => Promise<number>
}

type WorkerSlotLoopDependencies = {
  claimAvailableJobsForLane: (input: {
    lane: WorkerLane
    limit: number
  }) => Promise<ClaimedJob[]>
  processClaimedJob: (job: ClaimedJob) => Promise<void>
  reclaimStaleRunningJobsForLane: (input: {
    lane: WorkerLane
  }) => Promise<number>
  shouldContinue?: () => boolean
  sleep?: (ms: number) => Promise<void>
}

type WorkerStartDependencies = {
  runWorkerLaneSlotLoop?: (
    lane: WorkerLane,
    slotIndex: number,
    pollIntervalMs: number,
    dependencies: WorkerSlotLoopDependencies,
  ) => Promise<void>
}

const envModulePath = "../../../web/src/lib/env"
const queueModulePath = "../../../web/src/lib/jobs/queue"
const workerModulePath = "../../../web/src/lib/jobs/worker"

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function runWorkerLaneSlotLoop(
  lane: WorkerLane,
  _slotIndex: number,
  pollIntervalMs: number,
  dependencies: WorkerSlotLoopDependencies,
) {
  const shouldContinue = dependencies.shouldContinue ?? (() => true)
  const sleepImpl = dependencies.sleep ?? sleep

  while (shouldContinue()) {
    try {
      await dependencies.reclaimStaleRunningJobsForLane({ lane })

      const [job] = await dependencies.claimAvailableJobsForLane({
        lane,
        limit: 1,
      })

      if (!job) {
        await sleepImpl(pollIntervalMs)
        continue
      }

      await dependencies.processClaimedJob(job)
    } catch (error) {
      console.error(`[worker] ${lane} lane failed`, error)
      await sleepImpl(pollIntervalMs)
    }
  }
}

export async function runWorkerLaneLoop(
  lane: WorkerLane,
  pollIntervalMs: number,
  dependencies: WorkerSlotLoopDependencies,
) {
  await runWorkerLaneSlotLoop(lane, 0, pollIntervalMs, dependencies)
}

export async function loadWorkerRuntime(): Promise<WorkerRuntime> {
  const [envModule, queueModule, workerModule] = await Promise.all([
    import(envModulePath),
    import(queueModulePath),
    import(workerModulePath),
  ])

  return {
    claimAvailableJobsForLane:
      queueModule.claimAvailableJobsForLane as WorkerRuntime["claimAvailableJobsForLane"],
    ensureWorkerSchedulerJobsSeeded:
      workerModule.ensureWorkerSchedulerJobsSeeded as WorkerRuntime["ensureWorkerSchedulerJobsSeeded"],
    getEnv: envModule.getEnv as WorkerRuntime["getEnv"],
    getLaneConcurrency:
      workerModule.getLaneConcurrency as WorkerRuntime["getLaneConcurrency"],
    getRuntimeSshAuthSource:
      envModule.getRuntimeSshAuthSource as WorkerRuntime["getRuntimeSshAuthSource"],
    getWorkerLanes:
      workerModule.getWorkerLanes as WorkerRuntime["getWorkerLanes"],
    processClaimedJob:
      workerModule.processClaimedJob as WorkerRuntime["processClaimedJob"],
    reclaimStaleRunningJobsForLane:
      queueModule.reclaimStaleRunningJobsForLane as WorkerRuntime["reclaimStaleRunningJobsForLane"],
  }
}

export async function startWorker(
  runtime: WorkerRuntime,
  dependencies?: WorkerStartDependencies,
) {
  const env = runtime.getEnv()

  console.info("[worker] starting control-plane worker")
  console.info(
    `[worker] runtime SSH auth source: ${runtime.getRuntimeSshAuthSource()}`,
  )

  await runtime.ensureWorkerSchedulerJobsSeeded()

  const runSlotLoop =
    dependencies?.runWorkerLaneSlotLoop ?? runWorkerLaneSlotLoop

  await Promise.all(
    runtime.getWorkerLanes().flatMap((lane) =>
      Array.from({ length: runtime.getLaneConcurrency(lane) }, (_, slotIndex) =>
        runSlotLoop(lane, slotIndex, env.WORKER_POLL_INTERVAL_MS, {
          claimAvailableJobsForLane: runtime.claimAvailableJobsForLane,
          processClaimedJob: runtime.processClaimedJob,
          reclaimStaleRunningJobsForLane:
            runtime.reclaimStaleRunningJobsForLane,
        }),
      ),
    ),
  )
}

export async function main() {
  const runtime = await loadWorkerRuntime()
  await startWorker(runtime)
}
