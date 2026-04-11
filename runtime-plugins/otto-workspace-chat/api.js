import {
  buildChannelOutboundSessionRoute,
  createChatChannelPlugin,
} from "openclaw/plugin-sdk/channel-core";
import { getChatChannelMeta } from "openclaw/plugin-sdk/channel-plugin-common";

import {
  hasConfiguredWorkspaceChatRuntime,
  resolveWorkspaceChatAccount,
  WORKSPACE_CHAT_CHANNEL_ID as CHANNEL_ID,
  WORKSPACE_CHAT_DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID,
} from "./channel-config.js";
import { sendWorkspaceChatText } from "./outbound.js";

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
  const [conversationId, query = ""] = normalized
    .replace(/^workspace:/, "")
    .split("?", 2);
  const assistantMessageId =
    new URLSearchParams(query).get("assistantMessageId")?.trim() || undefined;

  return {
    assistantMessageId,
    conversationId,
    target: normalized,
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
      properties: {
        managed: {
          type: "boolean",
        },
      },
    },
    config: {
      listAccountIds: () => [DEFAULT_ACCOUNT_ID],
      inspectAccount: (cfg, accountId) => resolveWorkspaceChatAccount(cfg, accountId),
      resolveAccount: (cfg, accountId) =>
        resolveWorkspaceChatAccount(cfg, accountId),
      defaultAccountId: () => DEFAULT_ACCOUNT_ID,
      isConfigured: (account) => account.configured,
      resolveAllowFrom: () => ["*"],
      resolveDefaultTo: () => undefined,
      unconfiguredReason: () =>
        "workspace chat requires managed runtime config plus Otto control-plane credentials",
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
      sendText: async (payload) => await sendWorkspaceChatText(payload),
    },
  },
});

export const __testing = {
  hasConfiguredWorkspaceChatRuntime,
  resolveWorkspaceChatAccount,
  sendWorkspaceChatText,
};
