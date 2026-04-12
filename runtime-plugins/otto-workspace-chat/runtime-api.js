let workspaceChatRuntime = null;

export { dispatchInboundReplyWithBase } from "openclaw/plugin-sdk/inbound-reply-dispatch";

export function setWorkspaceChatRuntime(runtime) {
  workspaceChatRuntime = runtime;
}

export function getWorkspaceChatRuntime() {
  return workspaceChatRuntime;
}
