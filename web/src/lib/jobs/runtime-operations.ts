import { getEnv } from "@/lib/env";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { RuntimeManager } from "@/lib/runtime/manager";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type RefreshRuntimeImagePayload,
} from "./types";

const runtimeManager = new RuntimeManager();

const REFRESH_RUNTIME_IMAGE_EVENTS = {
  restartingRuntime: "restarting_runtime_image",
  verifyingRuntime: "verifying_runtime_image",
  succeeded: "refresh_runtime_image_succeeded",
  failed: "refresh_runtime_image_failed",
} as const;

export async function processRefreshRuntimeImageJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.refreshRuntimeImage) {
    throw new Error(
      `Unsupported job type for runtime refresh handler: ${job.jobType}`,
    );
  }

  const payload = parseRefreshRuntimeImagePayload(job.payload);

  try {
    const runtimeConnection = await getTenantRuntimeConnection(
      payload.tenantId,
      "platform admin image refresh",
    );
    const image = getEnv().RUNTIME_OPENCLAW_IMAGE;

    await appendJobEvent(
      job.id,
      REFRESH_RUNTIME_IMAGE_EVENTS.restartingRuntime,
      "Pulling the configured runtime image and restarting the tenant runtime",
      {
        host: runtimeConnection.host,
        image,
      },
    );

    const restart =
      await runtimeManager.restartGatewayWithResult(runtimeConnection);

    await appendJobEvent(
      job.id,
      REFRESH_RUNTIME_IMAGE_EVENTS.verifyingRuntime,
      "Verifying runtime health after image refresh",
      {
        host: runtimeConnection.host,
        image,
      },
    );

    const verify =
      await runtimeManager.checkGatewayHealthWithResult(runtimeConnection);

    const result = {
      host: runtimeConnection.host,
      image,
      note: "restartGatewayWithResult pulls the configured runtime image before recreating the container",
      restartStderr: restart.stderr,
      restartStdout: restart.stdout,
      tenantId: payload.tenantId,
      verifyStderr: verify.stderr,
      verifyStdout: verify.stdout,
    };

    await appendJobEvent(
      job.id,
      REFRESH_RUNTIME_IMAGE_EVENTS.succeeded,
      "Runtime image refresh completed successfully",
      {
        host: runtimeConnection.host,
        image,
      },
    );
    await markJobSucceeded(job.id, result);
  } catch (error) {
    const message = getErrorMessage(error);

    await appendJobEvent(
      job.id,
      REFRESH_RUNTIME_IMAGE_EVENTS.failed,
      "Runtime image refresh failed",
      {
        error: message,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

function parseRefreshRuntimeImagePayload(
  payload: Record<string, unknown>,
): RefreshRuntimeImagePayload {
  const tenantId = payload.tenantId;

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Refresh runtime image job payload is missing tenantId");
  }

  return {
    tenantId,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
