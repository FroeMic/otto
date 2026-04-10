import {
  buildChannelOutboundSessionRoute,
  createChatChannelPlugin,
} from "openclaw/plugin-sdk/channel-core";
import { getChatChannelMeta } from "openclaw/plugin-sdk/channel-plugin-common";

const CHANNEL_ID = "otto-workspace-chat";
const DEFAULT_ACCOUNT_ID = "default";
const meta = { ...getChatChannelMeta(CHANNEL_ID) };

function normalizeWorkspaceTarget(raw) {
  if (typeof raw !== "string") {
    return "";
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("workspace:") ? trimmed : `workspace:${trimmed}`;
}

function parseWorkspaceTarget(raw) {
  const normalized = normalizeWorkspaceTarget(raw);
  const conversationId = normalized.replace(/^workspace:/, "");

  return {
    conversationId,
    target: normalized,
  };
}

async function sendWorkspaceChatText() {
  throw new Error(
    "otto-workspace-chat outbound delivery is not wired yet. The tenant bridge must register runtime delivery callbacks before this channel can send messages.",
  );
}

function resolveWorkspaceChatAccount(accountId) {
  const resolvedAccountId =
    typeof accountId === "string" && accountId.trim()
      ? accountId.trim()
      : DEFAULT_ACCOUNT_ID;

  return {
    accountId: resolvedAccountId,
    configured: false,
    enabled: true,
    name: "Workspace",
  };
}

export const workspaceChatChannelPlugin = createChatChannelPlugin({
  base: {
    id: CHANNEL_ID,
    meta,
    capabilities: {
      chatTypes: ["group"],
    },
    reload: { configPrefixes: ["channels.otto-workspace-chat"] },
    configSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    config: {
      listAccountIds: () => [DEFAULT_ACCOUNT_ID],
      resolveAccount: (_cfg, accountId) =>
        resolveWorkspaceChatAccount(accountId),
      defaultAccountId: () => DEFAULT_ACCOUNT_ID,
      isConfigured: (account) => account.configured,
      resolveAllowFrom: () => ["*"],
      resolveDefaultTo: () => undefined,
    },
    messaging: {
      normalizeTarget: normalizeWorkspaceTarget,
      parseExplicitTarget: ({ raw }) => ({
        chatType: "group",
        to: normalizeWorkspaceTarget(raw),
      }),
      inferTargetChatType: () => "group",
      targetResolver: {
        looksLikeId: (raw) => normalizeWorkspaceTarget(raw).length > 0,
        hint: "workspace:<conversation-id>",
      },
      resolveOutboundSessionRoute: ({ cfg, agentId, accountId, target, threadId }) => {
        const parsed = parseWorkspaceTarget(target);

        return buildChannelOutboundSessionRoute({
          cfg,
          agentId,
          channel: CHANNEL_ID,
          accountId,
          peer: {
            kind: "channel",
            id: parsed.conversationId,
          },
          chatType: "group",
          from: `${CHANNEL_ID}:${accountId ?? DEFAULT_ACCOUNT_ID}`,
          to: parsed.target,
          threadId,
        });
      },
    },
    gateway: {
      startAccount: async () => undefined,
    },
  },
  outbound: {
    base: {
      deliveryMode: "direct",
    },
    attachedResults: {
      channel: CHANNEL_ID,
      sendText: async (payload) =>
        await sendWorkspaceChatText(payload),
    },
  },
});
