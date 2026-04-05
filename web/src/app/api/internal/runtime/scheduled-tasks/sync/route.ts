import { NextResponse } from "next/server";

import {
  listTenantScheduledTasks,
  replaceTenantScheduledTasksSnapshot,
  upsertTenantScheduledTaskRuns,
} from "@/db/scheduled-tasks";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/types";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";
import {
  normalizeRuntimeRun,
  normalizeRuntimeTask,
  type RuntimeCronJob,
  type RuntimeCronRun,
} from "@/lib/scheduled-tasks/runtime-sync";

export const dynamic = "force-dynamic";

const MAX_TASKS_PER_REQUEST = 2_000;
const MAX_RUNS_PER_REQUEST = 500;

export async function POST(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = await request.json();
    const payload = validatePayload(body);

    const taskSnapshots = (payload.tasks ?? [])
      .map(normalizeRuntimeTask)
      .filter(
        (task): task is NonNullable<ReturnType<typeof normalizeRuntimeTask>> =>
          task !== null,
      );

    const taskNameByKey = new Map(
      taskSnapshots.map((task) => [task.taskKey, task.name] as const),
    );

    if (payload.runs) {
      // Backfill task names from DB for any runs whose job isn't in the
      // current task snapshot (e.g. delete-after-run jobs already removed
      // from cron.list by the time the run syncs).
      const runJobIds = new Set(
        (payload.runs as RuntimeCronRun[])
          .map((r) => r.jobId)
          .filter(
            (id): id is string =>
              typeof id === "string" &&
              id.trim().length > 0 &&
              !taskNameByKey.has(id),
          ),
      );

      if (runJobIds.size > 0) {
        const existingTasks = await listTenantScheduledTasks({ tenantId });
        for (const task of existingTasks) {
          if (runJobIds.has(task.taskKey)) {
            taskNameByKey.set(task.taskKey, task.name);
          }
        }
      }
    }

    const runSnapshots = (payload.runs ?? [])
      .map((run) => {
        const taskKey =
          typeof run.jobId === "string" && run.jobId.trim().length > 0
            ? run.jobId
            : null;

        return normalizeRuntimeRun(run, {
          taskKey,
          taskName: taskKey ? (taskNameByKey.get(taskKey) ?? null) : null,
        });
      })
      .filter(
        (run): run is NonNullable<ReturnType<typeof normalizeRuntimeRun>> =>
          run !== null,
      );

    if (payload.tasks) {
      await replaceTenantScheduledTasksSnapshot({
        tasks: taskSnapshots,
        tenantId,
      });
    }

    if (runSnapshots.length > 0) {
      await upsertTenantScheduledTaskRuns({
        runs: runSnapshots,
        tenantId,
      });

      // Trigger a session sync so cron session transcripts are pulled.
      // The plugin may not catch these because OpenClaw emits transcript
      // updates without a sessionKey for many code paths.
      await enqueueJob({
        jobType: JOB_TYPES.syncTenantSessions,
        payload: { tenantId },
      }).catch(() => {
        // Best-effort — don't fail the run sync if session sync can't be queued
      });
    }

    return json({
      ok: true,
      reason: payload.reason,
      source: payload.source,
      syncedRuns: runSnapshots.length,
      syncedTasks: taskSnapshots.length,
    });
  } catch (error) {
    return handleError(error);
  }
}

function validatePayload(body: unknown): {
  reason: string | null;
  runs: RuntimeCronRun[] | null;
  source: string | null;
  tasks: RuntimeCronJob[] | null;
} {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  const record = body as Record<string, unknown>;
  const hasTasks = Object.hasOwn(record, "tasks");
  const hasRuns = Object.hasOwn(record, "runs");

  if (!hasTasks && !hasRuns) {
    throw new ValidationError("Request body must include tasks or runs");
  }

  const tasks = validateObjectArray(
    record.tasks,
    "tasks",
    MAX_TASKS_PER_REQUEST,
    hasTasks,
  );
  const runs = validateObjectArray(
    record.runs,
    "runs",
    MAX_RUNS_PER_REQUEST,
    hasRuns,
  );

  return {
    reason: optString(record.reason),
    runs: runs as RuntimeCronRun[] | null,
    source: optString(record.source),
    tasks: tasks as RuntimeCronJob[] | null,
  };
}

function validateObjectArray(
  value: unknown,
  label: string,
  maxItems: number,
  required: boolean,
) {
  if (!required && value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${label} must be an array`);
  }

  if (value.length > maxItems) {
    throw new ValidationError(
      `${label} array must not exceed ${maxItems} items`,
    );
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ValidationError(`${label}[${index}] must be an object`);
    }

    return entry as Record<string, unknown>;
  });
}

function optString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function handleError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token")
  ) {
    return json({ code: "unauthorized", message: error.message }, 401);
  }

  if (error instanceof ValidationError) {
    return json({ code: "validation_error", message: error.message }, 400);
  }

  if (error instanceof Error) {
    console.error("[scheduled-tasks/sync] Unexpected error:", error.message);
    return json(
      { code: "scheduled_task_sync_failed", message: error.message },
      500,
    );
  }

  return json(
    {
      code: "scheduled_task_sync_failed",
      message: "Scheduled task sync failed",
    },
    500,
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
