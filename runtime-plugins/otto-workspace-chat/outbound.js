import { sendWorkspaceChatCompletion } from "./control-plane-client.js";
import { parseWorkspaceTarget } from "./target.js";

const CHANNEL_ID = "otto-workspace-chat";

export async function sendWorkspaceChatText({
  text,
  to,
}) {
  const target = parseWorkspaceTarget(to);
  const response = await sendWorkspaceChatCompletion({
    assistantDisplayName: "Otto",
    assistantMessageId: target.assistantMessageId,
    conversationId: target.conversationId,
    parts: [
      {
        text,
        type: "text",
      },
    ],
    session: {
      sessionKey: target.target,
      status: "completed",
    },
  });

  return {
    channel: CHANNEL_ID,
    messageId: response.messageId,
  };
}
