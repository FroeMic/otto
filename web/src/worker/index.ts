import { getEnv, getRuntimeSshAuthSource } from "../lib/env";
import { runWorkerIteration } from "../lib/jobs/worker";

async function main() {
  const env = getEnv();

  console.info("[worker] starting control-plane worker");
  console.info(
    `[worker] runtime SSH auth source: ${getRuntimeSshAuthSource()}`,
  );

  while (true) {
    const processedCount = await runWorkerIteration();

    if (processedCount === 0) {
      await sleep(env.WORKER_POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
