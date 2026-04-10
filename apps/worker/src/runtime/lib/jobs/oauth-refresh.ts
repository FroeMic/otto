import {
  applyOauthRefreshSuccess,
  claimOauthConnectionForRefresh,
  listOauthConnectionsNeedingRefresh,
  recordOauthRefreshFailure,
} from "../../db/oauth";
import { getOAuthProviderDefinition } from "../oauth/providers";

import {
  appendJobEvent,
  enqueueJob,
  listQueuedOrRunningJobsByType,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type RefreshOauthConnectionPayload,
  type ScheduleOauthConnectionRefreshPayload,
} from "./types";

const OAUTH_REFRESH_SCHEDULER_INTERVAL_MS = 30_000;

export async function processScheduleOauthConnectionRefreshJob(
  job: ClaimedJob,
) {
  if (job.jobType !== JOB_TYPES.scheduleOauthConnectionRefresh) {
    throw new Error(
      `Unsupported job type for OAuth refresh scheduler: ${job.jobType}`,
    );
  }

  const payload = parseScheduleOauthConnectionRefreshPayload(job.payload);

  try {
    const queuedCount = await scheduleOauthConnectionRefreshJobs();

    await appendJobEvent(
      job.id,
      "oauth_refresh_scheduler_succeeded",
      `Queued ${queuedCount} OAuth refresh jobs`,
      {
        queuedCount,
      },
    );
    await requeueJob(
      job.id,
      payload,
      new Date(Date.now() + OAUTH_REFRESH_SCHEDULER_INTERVAL_MS),
    );
  } catch (error) {
    const message = getErrorMessage(error);

    await appendJobEvent(
      job.id,
      "oauth_refresh_scheduler_failed",
      `OAuth refresh scheduler failed: ${message}`,
    );
    await markJobFailed(
      job.id,
      message,
      new Date(Date.now() + OAUTH_REFRESH_SCHEDULER_INTERVAL_MS),
    );
  }
}

export async function processRefreshOauthConnectionJob(job: ClaimedJob) {
  if (job.jobType !== JOB_TYPES.refreshOauthConnection) {
    throw new Error(
      `Unsupported job type for OAuth refresh handler: ${job.jobType}`,
    );
  }

  const payload = parseRefreshOauthConnectionPayload(job.payload);

  if (!payload) {
    throw new Error(
      "OAuth refresh job payload is missing connectionId or tenantId",
    );
  }

  let claimedConnection: Awaited<
    ReturnType<typeof claimOauthConnectionForRefresh>
  > | null = null;

  try {
    claimedConnection = await claimOauthConnectionForRefresh({
      connectionId: payload.connectionId,
    });

    if (!claimedConnection?.refreshToken) {
      await appendJobEvent(
        job.id,
        "oauth_refresh_skipped",
        "Skipped OAuth refresh because the connection is no longer refreshable",
        {
          connectionId: payload.connectionId,
        },
      );
      await markJobSucceeded(job.id, {
        connectionId: payload.connectionId,
        skipped: true,
      });
      return;
    }

    const provider = getOAuthProviderDefinition(claimedConnection.providerKey);

    if (!provider) {
      const message = `Unsupported OAuth provider: ${claimedConnection.providerKey}`;

      await recordOauthRefreshFailure({
        connectionId: claimedConnection.connectionId,
        errorMessage: message,
        kind: "reauthorize",
        providerKey: claimedConnection.providerKey,
        tenantIntegrationId: claimedConnection.tenantIntegrationId,
      });
      await appendJobEvent(job.id, "oauth_refresh_failed", message, {
        connectionId: claimedConnection.connectionId,
        providerKey: claimedConnection.providerKey,
      });
      await markJobFailed(job.id, message);
      return;
    }

    const tokenResult = await provider.refreshAccessToken({
      refreshToken: claimedConnection.refreshToken,
    });

    await applyOauthRefreshSuccess({
      connectionId: claimedConnection.connectionId,
      providerKey: claimedConnection.providerKey,
      requestedScopes: provider.getRequestedScopes(),
      tenantIntegrationId: claimedConnection.tenantIntegrationId,
      tokenResult,
    });

    await appendJobEvent(
      job.id,
      "oauth_refresh_succeeded",
      "Refreshed OAuth access token",
      {
        connectionId: claimedConnection.connectionId,
        providerKey: claimedConnection.providerKey,
      },
    );
    await markJobSucceeded(job.id, {
      connectionId: claimedConnection.connectionId,
      providerKey: claimedConnection.providerKey,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const provider = claimedConnection
      ? getOAuthProviderDefinition(claimedConnection.providerKey)
      : null;

    if (claimedConnection) {
      await recordOauthRefreshFailure({
        connectionId: claimedConnection.connectionId,
        errorMessage: message,
        kind: provider?.classifyError(error) ?? "transient",
        providerKey: claimedConnection.providerKey,
        tenantIntegrationId: claimedConnection.tenantIntegrationId,
      });
    }

    await appendJobEvent(
      job.id,
      "oauth_refresh_failed",
      `OAuth refresh failed: ${message}`,
      {
        connectionId: payload.connectionId,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

async function scheduleOauthConnectionRefreshJobs() {
  const refreshableConnections = await listOauthConnectionsNeedingRefresh({
    limit: 5,
  });
  const activeJobs = await listQueuedOrRunningJobsByType(
    JOB_TYPES.refreshOauthConnection,
  );
  const activeConnectionIds = new Set<string>();

  for (const activeJob of activeJobs) {
    const payload = parseRefreshOauthConnectionPayload(activeJob.payload, {
      allowInvalid: true,
    });

    if (payload) {
      activeConnectionIds.add(payload.connectionId);
    }
  }

  let queuedCount = 0;

  for (const connection of refreshableConnections) {
    if (activeConnectionIds.has(connection.connectionId)) {
      continue;
    }

    await enqueueJob({
      jobType: JOB_TYPES.refreshOauthConnection,
      payload: {
        connectionId: connection.connectionId,
        tenantId: connection.tenantId,
      },
    });
    activeConnectionIds.add(connection.connectionId);
    queuedCount += 1;
  }

  return queuedCount;
}

function parseScheduleOauthConnectionRefreshPayload(
  payload: Record<string, unknown>,
): ScheduleOauthConnectionRefreshPayload {
  return payload as ScheduleOauthConnectionRefreshPayload;
}

function parseRefreshOauthConnectionPayload(
  payload: Record<string, unknown>,
  options?: {
    allowInvalid?: boolean;
  },
): RefreshOauthConnectionPayload | null {
  const connectionId = payload.connectionId;
  const tenantId = payload.tenantId;

  if (
    typeof connectionId !== "string" ||
    connectionId.length === 0 ||
    typeof tenantId !== "string" ||
    tenantId.length === 0
  ) {
    if (options?.allowInvalid) {
      return null;
    }

    throw new Error(
      "OAuth refresh job payload is missing connectionId or tenantId",
    );
  }

  return {
    connectionId,
    tenantId,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "OAuth token refresh failed.";
}
