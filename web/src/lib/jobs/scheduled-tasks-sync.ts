import {
  markTenantScheduledTasksSyncFailed,
  type ScheduledTaskSessionSnapshotRow,
  upsertTenantScheduledTasksSnapshot,
} from "@/db/scheduled-tasks";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { RuntimeManager } from "@/lib/runtime/manager";
import {
  normalizeRuntimeRun,
  normalizeRuntimeTask,
  type RuntimeCronRun,
  readCronListEntries,
  readCronRunEntries,
} from "@/lib/scheduled-tasks/runtime-sync";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type ReconcileTenantScheduledTasksPayload,
} from "./types";

const runtimeManager = new RuntimeManager();

export async function processReconcileTenantScheduledTasksJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.reconcileTenantScheduledTasks) {
    throw new Error(
      `Unsupported job type for scheduled-task sync handler: ${job.jobType}`,
    );
  }

  const payload = parsePayload(job.payload);

  try {
    await appendJobEvent(
      job.id,
      "connecting_runtime",
      "Connecting to tenant runtime",
    );

    const connection = await getTenantRuntimeConnection(
      payload.tenantId,
      "scheduled task refresh",
    );

    await appendJobEvent(
      job.id,
      "listing_scheduled_tasks",
      "Fetching scheduled tasks from runtime",
    );

    const tasksPage = await runtimeManager.invokeGatewayTool(connection, {
      action: "list",
      args: { includeDisabled: true },
      tool: "cron",
    });
    const runtimeTasks = readCronListEntries(tasksPage);

    await appendJobEvent(
      job.id,
      "fetching_task_runs",
      `Fetching recent runs for ${runtimeTasks.length} scheduled tasks`,
    );

    const runtimeRuns: RuntimeCronRun[] = [];
    for (const runtimeTask of runtimeTasks) {
      if (!runtimeTask.id) {
        continue;
      }

      const runsPage = await runtimeManager.invokeGatewayTool(connection, {
        action: "runs",
        args: { jobId: runtimeTask.id },
        tool: "cron",
      });
      runtimeRuns.push(...readCronRunEntries(runsPage));
    }

    const taskSnapshots = runtimeTasks
      .map(normalizeRuntimeTask)
      .filter(
        (task): task is NonNullable<ReturnType<typeof normalizeRuntimeTask>> =>
          task !== null,
      );
    const taskNamesByKey = new Map(
      taskSnapshots.map((task) => [task.taskKey, task.name] as const),
    );

    const runSnapshots: ScheduledTaskSessionSnapshotRow[] = [];
    for (const run of runtimeRuns) {
      const taskKey =
        typeof run.jobId === "string" && run.jobId.length > 0
          ? run.jobId
          : null;
      const snapshot = normalizeRuntimeRun(run, {
        taskKey,
        taskName: taskKey ? (taskNamesByKey.get(taskKey) ?? null) : null,
      });
      if (snapshot) {
        runSnapshots.push(snapshot);
      }
    }

    await upsertTenantScheduledTasksSnapshot({
      runs: runSnapshots,
      tasks: taskSnapshots,
      tenantId: payload.tenantId,
    });

    await appendJobEvent(
      job.id,
      "succeeded",
      `Synced ${taskSnapshots.length} scheduled tasks and ${runSnapshots.length} runs`,
    );
    await markJobSucceeded(job.id, {
      syncedRuns: runSnapshots.length,
      syncedTasks: taskSnapshots.length,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await markTenantScheduledTasksSyncFailed({
      error: message,
      tenantId: payload.tenantId,
    });
    await appendJobEvent(
      job.id,
      "failed",
      `Scheduled task refresh failed: ${message}`,
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

function parsePayload(
  payload: Record<string, unknown>,
): ReconcileTenantScheduledTasksPayload {
  const tenantId = payload.tenantId;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Scheduled task refresh payload is missing tenantId");
  }

  return { tenantId };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
