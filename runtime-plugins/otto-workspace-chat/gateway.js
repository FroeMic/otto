import { dispatchWorkspaceChatInboundTurn } from "./inbound-dispatch.js";

const WORKSPACE_CHAT_GATEWAY_METHOD = "otto.workspaceChat.runTurn";

export function registerWorkspaceChatGatewayMethods(api) {
  api.registerGatewayMethod(
    WORKSPACE_CHAT_GATEWAY_METHOD,
    async ({ params, respond }) => {
      try {
        const conversationId =
          typeof params?.conversationId === "string" ? params.conversationId.trim() : "";
        const message = typeof params?.message === "string" ? params.message.trim() : "";
        const assistantMessageId =
          typeof params?.assistantMessageId === "string" &&
          params.assistantMessageId.trim().length > 0
            ? params.assistantMessageId.trim()
            : undefined;
        const conversationKind =
          params?.conversationKind === "ad_hoc" ||
          params?.conversationKind === "durable_named" ||
          params?.conversationKind === "external_surface"
            ? params.conversationKind
            : "ad_hoc";
        const conversationTitle =
          typeof params?.conversationTitle === "string" &&
          params.conversationTitle.trim().length > 0
            ? params.conversationTitle.trim()
            : `Workspace conversation ${conversationId || "unknown"}`;
        const conversationVisibility =
          params?.conversationVisibility === "personal" ? "personal" : "open";
        const senderDisplayName =
          typeof params?.senderDisplayName === "string" &&
          params.senderDisplayName.trim().length > 0
            ? params.senderDisplayName.trim()
            : "Workspace user";
        const senderExternalId =
          typeof params?.senderExternalId === "string" &&
          params.senderExternalId.trim().length > 0
            ? params.senderExternalId.trim()
            : "workspace-user";
        const userMessageId =
          typeof params?.userMessageId === "string" && params.userMessageId.trim().length > 0
            ? params.userMessageId.trim()
            : undefined;

        console.info("[workspace-chat] gateway method invoked", {
          assistantMessageId: assistantMessageId ?? null,
          conversationId: conversationId || null,
          messageLength: message.length,
          senderExternalId,
          userMessageId: userMessageId ?? null,
        });

        if (!conversationId) {
          console.warn("[workspace-chat] gateway method missing conversationId");
          respond(false, { error: "conversationId required" });
          return;
        }

        if (!message) {
          console.warn("[workspace-chat] gateway method missing message", {
            conversationId,
          });
          respond(false, { error: "message required" });
          return;
        }

        const result = await dispatchWorkspaceChatInboundTurn(
          {
            ...(assistantMessageId ? { assistantMessageId } : {}),
            conversationKind,
            conversationId,
            conversationTitle,
            conversationVisibility,
            message,
            senderDisplayName,
            senderExternalId,
            ...(userMessageId ? { userMessageId } : {}),
          },
          {
            cfg: api.config ?? {},
            runtime: api.runtime,
          },
        );

        console.info("[workspace-chat] gateway method completed", {
          assistantMessageId: assistantMessageId ?? null,
          conversationId,
          sessionKey: result.sessionKey,
        });
        respond(true, result);
      } catch (error) {
        console.error("[workspace-chat] gateway method failed", {
          error: getErrorMessage(error),
        });
        respond(false, { error: getErrorMessage(error) });
      }
    },
    {
      scope: "operator.write",
    },
  );
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Workspace chat turn failed";
}
