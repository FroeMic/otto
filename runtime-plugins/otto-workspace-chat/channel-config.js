const CHANNEL_ID = "otto-workspace-chat";
const DEFAULT_ACCOUNT_ID = "default";

export function resolveWorkspaceChatChannelConfig(cfg) {
  const channels =
    cfg && typeof cfg === "object" && cfg.channels && typeof cfg.channels === "object"
      ? cfg.channels
      : null;
  const channelConfig =
    channels &&
    CHANNEL_ID in channels &&
    typeof channels[CHANNEL_ID] === "object" &&
    channels[CHANNEL_ID] !== null
      ? channels[CHANNEL_ID]
      : null;

  return channelConfig;
}

export function hasConfiguredWorkspaceChatRuntime(env = process.env) {
  const baseUrl =
    typeof env.OTTO_CONTROL_PLANE_BASE_URL === "string"
      ? env.OTTO_CONTROL_PLANE_BASE_URL.trim()
      : "";
  const tenantToken =
    typeof env.TENANT_TOKEN === "string" ? env.TENANT_TOKEN.trim() : "";

  return baseUrl.length > 0 && tenantToken.length > 0;
}

export function resolveWorkspaceChatAccount(cfg, accountId, env = process.env) {
  const resolvedAccountId =
    typeof accountId === "string" && accountId.trim()
      ? accountId.trim()
      : DEFAULT_ACCOUNT_ID;
  const channelConfig = resolveWorkspaceChatChannelConfig(cfg);
  const configured = Boolean(channelConfig?.managed) && hasConfiguredWorkspaceChatRuntime(env);

  return {
    accountId: resolvedAccountId,
    configured,
    enabled: true,
    name: "Workspace",
  };
}

export const WORKSPACE_CHAT_CHANNEL_ID = CHANNEL_ID;
export const WORKSPACE_CHAT_DEFAULT_ACCOUNT_ID = DEFAULT_ACCOUNT_ID;
