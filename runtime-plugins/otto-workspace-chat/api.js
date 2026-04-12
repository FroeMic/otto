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
import {
  inferWorkspaceTargetChatType,
  normalizeWorkspaceTarget,
  parseWorkspaceTarget,
} from "./target.js";

const meta = { ...getChatChannelMeta(CHANNEL_ID) };

export const workspaceChatChannelPlugin = createChatChannelPlugin({
  base: {
    id: CHANNEL_ID,
    meta,
    capabilities: {
      chatTypes: ["direct", "group"],
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
      parseExplicitTarget: ({ raw }) => {
        const target = normalizeWorkspaceTarget(raw);

        return {
          chatType: inferWorkspaceTargetChatType(target),
          to: target,
        };
      },
      inferTargetChatType: ({ raw, target }) =>
        inferWorkspaceTargetChatType(target ?? raw ?? ""),
      targetResolver: {
        looksLikeId: (raw) => normalizeWorkspaceTarget(raw).length > 0,
        hint: "workspace:<conversation-id>",
      },
      resolveOutboundSessionRoute: ({ cfg, agentId, accountId, target, threadId }) => {
        const parsed = parseWorkspaceTarget(target);
        const chatType =
          parsed.conversationVisibility === "personal" ? "direct" : "group";

        return buildChannelOutboundSessionRoute({
          cfg,
          agentId,
          channel: CHANNEL_ID,
          accountId,
          peer: {
            kind: chatType === "direct" ? "direct" : "channel",
            id: parsed.conversationId,
          },
          chatType,
          from: `${CHANNEL_ID}:${accountId ?? DEFAULT_ACCOUNT_ID}`,
          to: parsed.target,
          threadId,
        });
      },
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
