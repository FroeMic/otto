import { and, eq } from "drizzle-orm";
import {
  integrationMessagingConversations,
  integrationMessagingWorkspaceMembers,
  integrationMessagingWorkspaces,
  tenantIntegrations,
} from "@/db/schema";
import type { SlackRuntimeConfig } from "@/lib/slack-config";
import type { DbTransaction } from "@/tools/server-types";
import {
  deriveSlackPolicyEffects,
  type SlackPolicyDerivedEffects,
} from "@/tools/slack/policy";

const SLACK_PROVIDER_KEY = "slack";

export async function getSlackDirectoryOptionsForTenant(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [workspace] = await tx
    .select({
      id: integrationMessagingWorkspaces.id,
    })
    .from(integrationMessagingWorkspaces)
    .innerJoin(
      tenantIntegrations,
      eq(
        integrationMessagingWorkspaces.tenantIntegrationId,
        tenantIntegrations.id,
      ),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!workspace) {
    return {
      availableChannels: [],
      availableUsers: [],
    };
  }

  const [channelRows, userRows] = await Promise.all([
    tx
      .select({
        description: integrationMessagingConversations.topic,
        id: integrationMessagingConversations.externalConversationId,
        isArchived: integrationMessagingConversations.isArchived,
        label: integrationMessagingConversations.name,
        metadataJson: integrationMessagingConversations.metadataJson,
        purpose: integrationMessagingConversations.purpose,
        type: integrationMessagingConversations.conversationType,
      })
      .from(integrationMessagingConversations)
      .where(
        eq(
          integrationMessagingConversations.messagingWorkspaceId,
          workspace.id,
        ),
      ),
    tx
      .select({
        description: integrationMessagingWorkspaceMembers.fullName,
        id: integrationMessagingWorkspaceMembers.externalMemberId,
        isDeleted: integrationMessagingWorkspaceMembers.isDeleted,
        label: integrationMessagingWorkspaceMembers.displayName,
        secondaryLabel: integrationMessagingWorkspaceMembers.username,
      })
      .from(integrationMessagingWorkspaceMembers)
      .where(
        eq(
          integrationMessagingWorkspaceMembers.messagingWorkspaceId,
          workspace.id,
        ),
      ),
  ]);

  return {
    availableChannels: channelRows.map((channel) => ({
      description: channel.purpose ?? channel.description ?? null,
      id: channel.id,
      isArchived: channel.isArchived,
      isMember:
        channel.metadataJson &&
        typeof channel.metadataJson === "object" &&
        "is_member" in channel.metadataJson
          ? Boolean(channel.metadataJson.is_member)
          : false,
      label: channel.label ?? channel.id,
      memberCount:
        channel.metadataJson &&
        typeof channel.metadataJson === "object" &&
        "num_members" in channel.metadataJson &&
        typeof channel.metadataJson.num_members === "number"
          ? channel.metadataJson.num_members
          : null,
      secondaryLabel: channel.type === "private_channel" ? "Private" : "Public",
      visibility: channel.type === "private_channel" ? "private" : "public",
    })),
    availableUsers: userRows
      .filter((user) => !user.isDeleted)
      .map((user) => ({
        description: user.description ?? null,
        id: user.id,
        label: user.label ?? user.id,
        secondaryLabel: user.secondaryLabel ?? null,
      })),
  };
}

export async function validateSlackRuntimeConfigSemanticsForTenant(
  tx: DbTransaction,
  input: {
    config: SlackRuntimeConfig;
    tenantId: string;
  },
) {
  const { availableChannels, availableUsers } =
    await getSlackDirectoryOptionsForTenant(tx, {
      tenantId: input.tenantId,
    });

  if (
    availableChannels.length === 0 &&
    availableUsers.length === 0 &&
    input.config.allowedChannelIds.length === 0 &&
    input.config.allowedUserIds.length === 0
  ) {
    return;
  }

  const availableUserIds = new Set(availableUsers.map((user) => user.id));
  const missingUserIds = input.config.allowedUserIds.filter(
    (userId) => !availableUserIds.has(userId),
  );

  if (missingUserIds.length > 0) {
    throw new Error(
      `Slack users not found in the latest directory sync: ${missingUserIds.join(", ")}`,
    );
  }

  if (input.config.channelAccessMode === "member_of_channels") {
    return;
  }

  const availableChannelIds = new Set(
    availableChannels.map((channel) => channel.id),
  );
  const missingChannelIds = input.config.allowedChannelIds.filter(
    (channelId) => !availableChannelIds.has(channelId),
  );

  if (missingChannelIds.length > 0) {
    throw new Error(
      `Slack channels not found in the latest directory sync: ${missingChannelIds.join(", ")}`,
    );
  }

  const archivedChannelIds = input.config.allowedChannelIds.filter(
    (channelId) =>
      availableChannels.some(
        (channel) => channel.id === channelId && channel.isArchived,
      ),
  );

  if (archivedChannelIds.length > 0) {
    throw new Error(
      `Slack channels are archived and cannot be allowlisted: ${archivedChannelIds.join(", ")}`,
    );
  }
}

export async function evaluateSlackPolicyForTenant(
  tx: DbTransaction,
  input: {
    config: SlackRuntimeConfig;
    currentConfig?: SlackRuntimeConfig;
    tenantId: string;
  },
): Promise<SlackPolicyDerivedEffects> {
  const { availableChannels } = await getSlackDirectoryOptionsForTenant(tx, {
    tenantId: input.tenantId,
  });

  return deriveSlackPolicyEffects({
    config: input.config,
    currentConfig: input.currentConfig,
    directoryChannels: availableChannels,
  });
}
