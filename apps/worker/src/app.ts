type WorkerLane = string

type WorkerEnv = {
  WORKER_POLL_INTERVAL_MS: number
}

type WorkerRuntime = {
  ensureWorkerSchedulerJobsSeeded: () => Promise<void>
  getEnv: () => WorkerEnv
  getRuntimeSshAuthSource: () => string
  getWorkerLanes: () => WorkerLane[]
  runWorkerLaneIteration: (lane: WorkerLane) => Promise<number>
}

type WorkerLoopDependencies = {
  runWorkerLaneIteration: (lane: WorkerLane) => Promise<number>
  shouldContinue?: () => boolean
  sleep?: (ms: number) => Promise<void>
}

type WorkerStartDependencies = {
  runWorkerLaneLoop?: (
    lane: WorkerLane,
    pollIntervalMs: number,
    dependencies: WorkerLoopDependencies,
  ) => Promise<void>
}

const envModulePath = "../../../web/src/lib/env"
const workerModulePath = "../../../web/src/lib/jobs/worker"

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function runWorkerLaneLoop(
  lane: WorkerLane,
  pollIntervalMs: number,
  dependencies: WorkerLoopDependencies,
) {
  const shouldContinue = dependencies.shouldContinue ?? (() => true)
  const sleepImpl = dependencies.sleep ?? sleep

  while (shouldContinue()) {
    try {
      const processedCount = await dependencies.runWorkerLaneIteration(lane)

      if (processedCount === 0) {
        await sleepImpl(pollIntervalMs)
      }
    } catch (error) {
      console.error(`[worker] ${lane} lane failed`, error)
      await sleepImpl(pollIntervalMs)
    }
  }
}

export async function loadWorkerRuntime(): Promise<WorkerRuntime> {
  const [envModule, workerModule] = await Promise.all([
    import(envModulePath),
    import(workerModulePath),
  ])

  return {
    ensureWorkerSchedulerJobsSeeded:
      workerModule.ensureWorkerSchedulerJobsSeeded as WorkerRuntime["ensureWorkerSchedulerJobsSeeded"],
    getEnv: envModule.getEnv as WorkerRuntime["getEnv"],
    getRuntimeSshAuthSource:
      envModule.getRuntimeSshAuthSource as WorkerRuntime["getRuntimeSshAuthSource"],
    getWorkerLanes:
      workerModule.getWorkerLanes as WorkerRuntime["getWorkerLanes"],
    runWorkerLaneIteration:
      workerModule.runWorkerLaneIteration as WorkerRuntime["runWorkerLaneIteration"],
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

  const runLoop = dependencies?.runWorkerLaneLoop ?? runWorkerLaneLoop

  await Promise.all(
    runtime.getWorkerLanes().map((lane) =>
      runLoop(lane, env.WORKER_POLL_INTERVAL_MS, {
        runWorkerLaneIteration: runtime.runWorkerLaneIteration,
      }),
    ),
  )
}

export async function main() {
  const runtime = await loadWorkerRuntime()
  await startWorker(runtime)
}
