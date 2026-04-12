import { getTenantRuntimeGatewayToken, getTenantRuntimeTenantToken } from "../../db/control-plane";
import { getControlPlaneBaseUrl } from "../env";
import { getTenantRuntimeConnection } from "../runtime/connection";
import { RuntimeManager } from "../runtime/manager";

import { appendJobEvent, markJobFailed, markJobSucceeded } from "./queue";
import {
  type ClaimedJob,
  JOB_TYPES,
  type RunWorkspaceChatTurnPayload,
} from "./types";

const runtimeManager = new RuntimeManager();

const WORKSPACE_CHAT_EVENTS = {
  failed: "workspace_chat_turn_failed",
  queued: "workspace_chat_turn_started",
  succeeded: "workspace_chat_turn_succeeded",
} as const;

type ProcessWorkspaceChatDependencies = {
  appendJobEvent: typeof appendJobEvent;
  forwardWorkspaceChatIngressRequest: (input: {
    assistantMessageId?: string;
    connection: Awaited<ReturnType<typeof getTenantRuntimeConnection>>;
    conversationKind: "ad_hoc" | "durable_named" | "external_surface";
    conversationId: string;
    conversationTitle: string;
    conversationVisibility: "open" | "personal";
    gatewayToken: string;
    message: string;
    senderDisplayName: string;
    senderExternalId: string;
    userMessageId: string;
  }) => Promise<{
    ok: true;
    sessionKey: string;
  }>;
  getTenantRuntimeConnection: typeof getTenantRuntimeConnection;
  getTenantRuntimeGatewayToken: typeof getTenantRuntimeGatewayToken;
  getTenantRuntimeTenantToken: typeof getTenantRuntimeTenantToken;
  markAssistantMessageFailed: (input: {
    assistantMessageId?: string;
    conversationId: string;
    error: string;
    tenantId: string;
  }) => Promise<void>;
  markJobFailed: typeof markJobFailed;
  markJobSucceeded: typeof markJobSucceeded;
};

const defaultDependencies: ProcessWorkspaceChatDependencies = {
  appendJobEvent,
  forwardWorkspaceChatIngressRequest: async (input) =>
    await runtimeManager.forwardWorkspaceChatIngressRequest(input.connection, {
      assistantMessageId: input.assistantMessageId,
      conversationKind: input.conversationKind,
      conversationId: input.conversationId,
      conversationTitle: input.conversationTitle,
      conversationVisibility: input.conversationVisibility,
      gatewayToken: input.gatewayToken,
      message: input.message,
      senderDisplayName: input.senderDisplayName,
      senderExternalId: input.senderExternalId,
      userMessageId: input.userMessageId,
    }),
  getTenantRuntimeConnection,
  getTenantRuntimeGatewayToken,
  getTenantRuntimeTenantToken,
  markAssistantMessageFailed: async (input) => {
    if (!input.assistantMessageId) {
      return;
    }

    const tenantToken = await getTenantRuntimeTenantToken(input.tenantId);
    const baseUrl = getControlPlaneBaseUrl();

    if (!baseUrl) {
      throw new Error("Control-plane base URL is not configured");
    }

    if (!tenantToken) {
      throw new Error("Tenant runtime token is not configured");
    }

    const response = await fetch(
      `${baseUrl.replace(/\/+$/u, "")}/api/internal/runtime/workspace-chat/messages/fail`,
      {
        body: JSON.stringify({
          assistantDisplayName: "Otto",
          assistantMessageId: input.assistantMessageId,
          conversationId: input.conversationId,
          error: input.error,
        }),
        headers: {
          authorization: `Bearer ${tenantToken}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Workspace chat fail callback returned ${response.status}: ${text || "Unknown error"}`,
      );
    }
  },
  markJobFailed,
  markJobSucceeded,
};

export async function processRunWorkspaceChatTurnJob(
  job: ClaimedJob,
  dependencies: ProcessWorkspaceChatDependencies = defaultDependencies,
): Promise<void> {
  if (job.jobType !== JOB_TYPES.runWorkspaceChatTurn) {
    throw new Error(
      `Unsupported job type for workspace chat handler: ${job.jobType}`,
    );
  }

  const payload = parseRunWorkspaceChatTurnPayload(job.payload);

  console.info("[workspace-chat] worker job started", {
    assistantMessageId: payload.assistantMessageId ?? null,
    conversationId: payload.conversationId,
    jobId: job.id,
    tenantId: payload.tenantId,
  })

  try {
    const connection = await dependencies.getTenantRuntimeConnection(
      payload.tenantId,
      "workspace chat turn dispatch",
    );

    console.info("[workspace-chat] worker resolved tenant connection", {
      conversationId: payload.conversationId,
      host: connection.host,
      jobId: job.id,
      tenantId: payload.tenantId,
    })

    const gatewayToken = await dependencies.getTenantRuntimeGatewayToken(
      payload.tenantId,
    );

    if (!gatewayToken) {
      throw new Error("Tenant gateway token is not configured");
    }

    await dependencies.appendJobEvent(
      job.id,
      WORKSPACE_CHAT_EVENTS.queued,
      "Posting the workspace chat event to the tenant ingress route",
      {
        conversationId: payload.conversationId,
        host: connection.host,
      },
    );

    console.info("[workspace-chat] worker invoking tenant ingress route", {
      assistantMessageId: payload.assistantMessageId ?? null,
      conversationId: payload.conversationId,
      host: connection.host,
      jobId: job.id,
      tenantId: payload.tenantId,
    })

    const result = await dependencies.forwardWorkspaceChatIngressRequest({
      assistantMessageId: payload.assistantMessageId,
      connection,
      conversationKind: payload.conversationKind,
      conversationId: payload.conversationId,
      conversationTitle: payload.conversationTitle,
      conversationVisibility: payload.conversationVisibility,
      gatewayToken,
      message: payload.message,
      senderDisplayName: payload.senderDisplayName,
      senderExternalId: payload.senderExternalId,
      userMessageId: payload.userMessageId,
    });

    console.info("[workspace-chat] worker tenant ingress route succeeded", {
      conversationId: payload.conversationId,
      jobId: job.id,
      sessionKey: result.sessionKey,
      tenantId: payload.tenantId,
    })

    await dependencies.appendJobEvent(
      job.id,
      WORKSPACE_CHAT_EVENTS.succeeded,
      "Workspace chat message was accepted by the tenant runtime",
      {
        conversationId: payload.conversationId,
        sessionKey: result.sessionKey,
      },
    );
    await dependencies.markJobSucceeded(job.id, {
      conversationId: payload.conversationId,
      sessionKey: result.sessionKey,
      tenantId: payload.tenantId,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("[workspace-chat] worker tenant ingress route failed", {
      assistantMessageId: payload.assistantMessageId ?? null,
      conversationId: payload.conversationId,
      error: message,
      jobId: job.id,
      tenantId: payload.tenantId,
    })

    try {
      await dependencies.markAssistantMessageFailed({
        assistantMessageId: payload.assistantMessageId,
        conversationId: payload.conversationId,
        error: message,
        tenantId: payload.tenantId,
      });

      console.info("[workspace-chat] worker failure callback delivered", {
        assistantMessageId: payload.assistantMessageId ?? null,
        conversationId: payload.conversationId,
        jobId: job.id,
        tenantId: payload.tenantId,
      })
    } catch (callbackError) {
      console.error("[workspace-chat] worker failure callback delivery failed", {
        assistantMessageId: payload.assistantMessageId ?? null,
        callbackError: getErrorMessage(callbackError),
        conversationId: payload.conversationId,
        error: message,
        jobId: job.id,
        tenantId: payload.tenantId,
      })

      await dependencies.appendJobEvent(
        job.id,
        WORKSPACE_CHAT_EVENTS.failed,
        "Workspace chat fail callback could not be delivered",
        {
          callbackError: getErrorMessage(callbackError),
          error: message,
        },
      );
    }

    await dependencies.appendJobEvent(
      job.id,
      WORKSPACE_CHAT_EVENTS.failed,
      "Workspace chat ingress failed before the tenant runtime accepted the message",
      {
        error: message,
      },
    );
    await dependencies.markJobFailed(job.id, message);
  }
}

function parseRunWorkspaceChatTurnPayload(
  payload: Record<string, unknown>,
): RunWorkspaceChatTurnPayload {
  const assistantMessageId =
    typeof payload.assistantMessageId === "string" &&
    payload.assistantMessageId.length > 0
      ? payload.assistantMessageId
      : undefined;
  const conversationKind = payload.conversationKind;
  const conversationId = payload.conversationId;
  const conversationTitle = payload.conversationTitle;
  const conversationVisibility = payload.conversationVisibility;
  const message = payload.message;
  const senderDisplayName = payload.senderDisplayName;
  const senderExternalId = payload.senderExternalId;
  const tenantId = payload.tenantId;
  const userMessageId = payload.userMessageId;

  if (
    conversationKind !== "ad_hoc" &&
    conversationKind !== "durable_named" &&
    conversationKind !== "external_surface"
  ) {
    throw new Error("Workspace chat turn payload is missing conversationKind");
  }

  if (typeof conversationId !== "string" || conversationId.length === 0) {
    throw new Error("Workspace chat turn payload is missing conversationId");
  }

  if (typeof conversationTitle !== "string" || conversationTitle.length === 0) {
    throw new Error("Workspace chat turn payload is missing conversationTitle");
  }

  if (conversationVisibility !== "open" && conversationVisibility !== "personal") {
    throw new Error("Workspace chat turn payload is missing conversationVisibility");
  }

  if (typeof message !== "string" || message.length === 0) {
    throw new Error("Workspace chat turn payload is missing message");
  }

  if (typeof senderDisplayName !== "string" || senderDisplayName.length === 0) {
    throw new Error("Workspace chat turn payload is missing senderDisplayName");
  }

  if (typeof senderExternalId !== "string" || senderExternalId.length === 0) {
    throw new Error("Workspace chat turn payload is missing senderExternalId");
  }

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Workspace chat turn payload is missing tenantId");
  }

  if (typeof userMessageId !== "string" || userMessageId.length === 0) {
    throw new Error("Workspace chat turn payload is missing userMessageId");
  }

  return {
    ...(assistantMessageId ? { assistantMessageId } : {}),
    conversationKind,
    conversationId,
    conversationTitle,
    conversationVisibility,
    message,
    senderDisplayName,
    senderExternalId,
    tenantId,
    userMessageId,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unknown workspace chat worker error";
}
