import { and, eq, notInArray } from "drizzle-orm";

import { getDb } from "./client";
import {
  integrationMessagingConversations,
  integrationMessagingWorkspaceMembers,
  integrationMessagingWorkspaces,
} from "./schema";

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export type MessagingDirectoryMemberInput = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
  externalMemberId: string;
  fullName: string | null;
  isDeleted: boolean;
  memberType: "bot" | "user";
  profileJson: unknown;
  username: string | null;
};

export type MessagingConversationInput = {
  conversationType: string;
  externalConversationId: string;
  isArchived: boolean;
  metadataJson: unknown;
  name: string | null;
  purpose: string | null;
  topic: string | null;
};

export async function syncMessagingDirectoryForTenantIntegration(input: {
  conversations: MessagingConversationInput[];
  externalWorkspaceId: string;
  tenantIntegrationId: string;
  workspaceDisplayName: string | null;
  members: MessagingDirectoryMemberInput[];
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const messagingWorkspaceId = await upsertMessagingWorkspace(tx, {
      externalWorkspaceId: input.externalWorkspaceId,
      now,
      tenantIntegrationId: input.tenantIntegrationId,
      workspaceDisplayName: input.workspaceDisplayName,
    });

    for (const member of input.members) {
      if (!member.externalMemberId) {
        continue;
      }

      await tx
        .insert(integrationMessagingWorkspaceMembers)
        .values({
          avatarUrl: member.avatarUrl,
          displayName: member.displayName,
          email: member.email,
          externalMemberId: member.externalMemberId,
          fullName: member.fullName,
          isDeleted: member.isDeleted,
          lastSyncedAt: now,
          memberType: member.memberType,
          messagingWorkspaceId,
          profileJson: normalizeJsonValue(member.profileJson),
          username: member.username,
        })
        .onConflictDoUpdate({
          target: [
            integrationMessagingWorkspaceMembers.messagingWorkspaceId,
            integrationMessagingWorkspaceMembers.externalMemberId,
          ],
          set: {
            avatarUrl: member.avatarUrl,
            displayName: member.displayName,
            email: member.email,
            fullName: member.fullName,
            isDeleted: member.isDeleted,
            lastSyncedAt: now,
            memberType: member.memberType,
            profileJson: normalizeJsonValue(member.profileJson),
            updatedAt: now,
            username: member.username,
          },
        });
    }

    await removeStaleMessagingWorkspaceMembers(tx, {
      messagingWorkspaceId,
      syncedExternalMemberIds: input.members.map(
        (member) => member.externalMemberId,
      ),
    });

    for (const conversation of input.conversations) {
      if (!conversation.externalConversationId) {
        continue;
      }

      await tx
        .insert(integrationMessagingConversations)
        .values({
          conversationType: conversation.conversationType,
          externalConversationId: conversation.externalConversationId,
          isArchived: conversation.isArchived,
          lastSyncedAt: now,
          messagingWorkspaceId,
          metadataJson: normalizeJsonValue(conversation.metadataJson),
          name: conversation.name,
          purpose: conversation.purpose,
          topic: conversation.topic,
        })
        .onConflictDoUpdate({
          target: [
            integrationMessagingConversations.messagingWorkspaceId,
            integrationMessagingConversations.externalConversationId,
          ],
          set: {
            conversationType: conversation.conversationType,
            isArchived: conversation.isArchived,
            lastSyncedAt: now,
            metadataJson: normalizeJsonValue(conversation.metadataJson),
            name: conversation.name,
            purpose: conversation.purpose,
            topic: conversation.topic,
            updatedAt: now,
          },
        });
    }

    await removeStaleMessagingConversations(tx, {
      messagingWorkspaceId,
      syncedExternalConversationIds: input.conversations.map(
        (conversation) => conversation.externalConversationId,
      ),
    });

    await tx
      .update(integrationMessagingWorkspaces)
      .set({
        lastSyncError: null,
        lastSyncErrorAt: null,
        lastSyncedAt: now,
        syncStatus: "succeeded",
        updatedAt: now,
      })
      .where(eq(integrationMessagingWorkspaces.id, messagingWorkspaceId));
  });
}

export async function recordMessagingWorkspaceSyncFailure(input: {
  error: string;
  externalWorkspaceId: string;
  tenantIntegrationId: string;
  workspaceDisplayName: string | null;
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const messagingWorkspaceId = await upsertMessagingWorkspace(tx, {
      externalWorkspaceId: input.externalWorkspaceId,
      now,
      tenantIntegrationId: input.tenantIntegrationId,
      workspaceDisplayName: input.workspaceDisplayName,
    });

    await tx
      .update(integrationMessagingWorkspaces)
      .set({
        lastSyncError: input.error,
        lastSyncErrorAt: now,
        syncStatus: "failed",
        updatedAt: now,
      })
      .where(eq(integrationMessagingWorkspaces.id, messagingWorkspaceId));
  });
}

async function upsertMessagingWorkspace(
  tx: DbTransaction,
  input: {
    externalWorkspaceId: string;
    now: Date;
    tenantIntegrationId: string;
    workspaceDisplayName: string | null;
  },
) {
  const [existingWorkspace] = await tx
    .select({
      id: integrationMessagingWorkspaces.id,
    })
    .from(integrationMessagingWorkspaces)
    .where(
      and(
        eq(
          integrationMessagingWorkspaces.tenantIntegrationId,
          input.tenantIntegrationId,
        ),
        eq(
          integrationMessagingWorkspaces.externalWorkspaceId,
          input.externalWorkspaceId,
        ),
      ),
    )
    .limit(1);

  if (existingWorkspace) {
    await tx
      .update(integrationMessagingWorkspaces)
      .set({
        displayName: input.workspaceDisplayName,
        updatedAt: input.now,
      })
      .where(eq(integrationMessagingWorkspaces.id, existingWorkspace.id));

    return existingWorkspace.id;
  }

  const [createdWorkspace] = await tx
      .insert(integrationMessagingWorkspaces)
      .values({
        displayName: input.workspaceDisplayName,
        externalWorkspaceId: input.externalWorkspaceId,
        lastSyncedAt: input.now,
        syncStatus: "succeeded",
        tenantIntegrationId: input.tenantIntegrationId,
      })
    .returning({
      id: integrationMessagingWorkspaces.id,
    });

  return createdWorkspace.id;
}

async function removeStaleMessagingWorkspaceMembers(
  tx: DbTransaction,
  input: {
    messagingWorkspaceId: string;
    syncedExternalMemberIds: string[];
  },
) {
  const syncedIds = input.syncedExternalMemberIds.filter(Boolean);

  if (syncedIds.length > 0) {
    await tx
      .delete(integrationMessagingWorkspaceMembers)
      .where(
        and(
          eq(
            integrationMessagingWorkspaceMembers.messagingWorkspaceId,
            input.messagingWorkspaceId,
          ),
          notInArray(
            integrationMessagingWorkspaceMembers.externalMemberId,
            syncedIds,
          ),
        ),
      );
    return;
  }

  await tx
    .delete(integrationMessagingWorkspaceMembers)
    .where(
      eq(
        integrationMessagingWorkspaceMembers.messagingWorkspaceId,
        input.messagingWorkspaceId,
      ),
    );
}

async function removeStaleMessagingConversations(
  tx: DbTransaction,
  input: {
    messagingWorkspaceId: string;
    syncedExternalConversationIds: string[];
  },
) {
  const syncedIds = input.syncedExternalConversationIds.filter(Boolean);

  if (syncedIds.length > 0) {
    await tx
      .delete(integrationMessagingConversations)
      .where(
        and(
          eq(
            integrationMessagingConversations.messagingWorkspaceId,
            input.messagingWorkspaceId,
          ),
          notInArray(
            integrationMessagingConversations.externalConversationId,
            syncedIds,
          ),
        ),
      );
    return;
  }

  await tx
    .delete(integrationMessagingConversations)
    .where(
      eq(
        integrationMessagingConversations.messagingWorkspaceId,
        input.messagingWorkspaceId,
      ),
    );
}

function normalizeJsonValue(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return value;
}
