import {
  getSlackInstallationForTenant,
  getTenantSlackBotToken,
  resolveUserChannelIdentitiesFromDirectory,
  syncSlackChannelsForTenantIntegration,
  syncSlackUsersForTenantIntegration,
} from "../../db/control-plane";
import { fetchSlackConversations, fetchSlackUsers } from "../slack";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type ResyncSlackChannelsPayload,
  type ResyncSlackUsersPayload,
} from "./types";

// ---------------------------------------------------------------------------
// Resync Slack Users
// ---------------------------------------------------------------------------

export async function processResyncSlackUsersJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.resyncSlackUsers) {
    throw new Error(
      `Unsupported job type for Slack user sync handler: ${job.jobType}`,
    );
  }

  const payload = parseResyncSlackUsersPayload(job.payload);

  try {
    await appendJobEvent(
      job.id,
      "fetching_slack_installation",
      "Looking up Slack installation for tenant",
    );

    const installation = await getSlackInstallationForTenant(payload.tenantId);
    if (!installation) {
      throw new Error("No connected Slack installation found for tenant");
    }

    const botToken = await getTenantSlackBotToken(payload.tenantId);
    if (!botToken) {
      throw new Error("Slack bot token unavailable");
    }

    await appendJobEvent(
      job.id,
      "fetching_slack_users",
      "Fetching users from Slack API",
    );

    const members = await fetchSlackUsers(botToken);

    await appendJobEvent(
      job.id,
      "syncing_users",
      `Syncing ${members.length} users to database`,
    );

    const syncResult = await syncSlackUsersForTenantIntegration({
      externalWorkspaceId: installation.slackTeamId,
      tenantIntegrationId: installation.tenantIntegrationId,
      workspaceDisplayName: installation.slackTeamName,
      members,
    });

    await appendJobEvent(
      job.id,
      "resolving_identities",
      "Matching Otto users to Slack identities",
    );

    // Look up the organization ID from the tenant
    const { eq } = await import("drizzle-orm");
    const { getDb } = await import("../../db/client");
    const { tenants } = await import("../../db/schema");
    const db = getDb();
    const [tenant] = await db
      .select({ organizationId: tenants.organizationId })
      .from(tenants)
      .where(eq(tenants.id, payload.tenantId))
      .limit(1);

    let identityResult = { resolved: 0, skipped: 0 };
    if (tenant) {
      identityResult = await resolveUserChannelIdentitiesFromDirectory({
        organizationId: tenant.organizationId,
      });
    }

    await appendJobEvent(
      job.id,
      "succeeded",
      `Synced ${syncResult.synced} users, resolved ${identityResult.resolved} identities`,
    );
    await markJobSucceeded(job.id, {
      syncedUsers: syncResult.synced,
      resolvedIdentities: identityResult.resolved,
      skippedIdentities: identityResult.skipped,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await appendJobEvent(
      job.id,
      "failed",
      `Slack user sync failed: ${message}`,
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Resync Slack Channels
// ---------------------------------------------------------------------------

export async function processResyncSlackChannelsJob(
  job: ClaimedJob,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.resyncSlackChannels) {
    throw new Error(
      `Unsupported job type for Slack channel sync handler: ${job.jobType}`,
    );
  }

  const payload = parseResyncSlackChannelsPayload(job.payload);

  try {
    await appendJobEvent(
      job.id,
      "fetching_slack_installation",
      "Looking up Slack installation for tenant",
    );

    const installation = await getSlackInstallationForTenant(payload.tenantId);
    if (!installation) {
      throw new Error("No connected Slack installation found for tenant");
    }

    const botToken = await getTenantSlackBotToken(payload.tenantId);
    if (!botToken) {
      throw new Error("Slack bot token unavailable");
    }

    await appendJobEvent(
      job.id,
      "fetching_slack_channels",
      "Fetching channels from Slack API",
    );

    const conversations = await fetchSlackConversations(botToken);

    await appendJobEvent(
      job.id,
      "syncing_channels",
      `Syncing ${conversations.length} channels to database`,
    );

    const syncResult = await syncSlackChannelsForTenantIntegration({
      externalWorkspaceId: installation.slackTeamId,
      tenantIntegrationId: installation.tenantIntegrationId,
      workspaceDisplayName: installation.slackTeamName,
      conversations,
    });

    await appendJobEvent(
      job.id,
      "succeeded",
      `Synced ${syncResult.synced} channels`,
    );
    await markJobSucceeded(job.id, {
      syncedChannels: syncResult.synced,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    await appendJobEvent(
      job.id,
      "failed",
      `Slack channel sync failed: ${message}`,
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResyncSlackUsersPayload(
  payload: Record<string, unknown>,
): ResyncSlackUsersPayload {
  const tenantId = payload.tenantId;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Resync Slack users job payload is missing tenantId");
  }
  return { tenantId };
}

function parseResyncSlackChannelsPayload(
  payload: Record<string, unknown>,
): ResyncSlackChannelsPayload {
  const tenantId = payload.tenantId;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Resync Slack channels job payload is missing tenantId");
  }
  return { tenantId };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
