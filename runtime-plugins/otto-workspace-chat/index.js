import { defineBundledChannelEntry } from "openclaw/plugin-sdk/channel-entry-contract";
import { dispatchInboundReplyWithBase } from "openclaw/plugin-sdk/inbound-reply-dispatch";
import { registerWorkspaceChatPluginHttpRoutes } from "./http-routes.js";

export default defineBundledChannelEntry({
  id: "otto-workspace-chat",
  name: "Otto Workspace Chat",
  description: "Workspace chat channel scaffold for Otto-managed runtimes",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./api.js",
    exportName: "workspaceChatChannelPlugin",
  },
  runtime: {
    specifier: "./runtime-api.js",
    exportName: "setWorkspaceChatRuntime",
  },
  registerFull(api) {
    registerWorkspaceChatPluginHttpRoutes(api, {
      dispatchInboundReplyWithBase,
    });
  },
});
