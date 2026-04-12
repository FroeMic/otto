const DEFAULT_TIMEOUT_MS = 15_000;

export async function sendWorkspaceChatDelta(input) {
  return await requestControlPlane({
    body: {
      ...(input.assistantDisplayName
        ? { assistantDisplayName: input.assistantDisplayName }
        : {}),
      ...(input.assistantMessageId
        ? { assistantMessageId: input.assistantMessageId }
        : {}),
      conversationId: input.conversationId,
      message: {
        text: input.text,
      },
      sequence: input.sequence,
    },
    method: "POST",
    path: "/api/internal/runtime/workspace-chat/messages/delta",
  });
}

export async function sendWorkspaceChatCompletion(input) {
  return await requestControlPlane({
    body: {
      ...(input.assistantDisplayName
        ? { assistantDisplayName: input.assistantDisplayName }
        : {}),
      ...(input.assistantMessageId
        ? { assistantMessageId: input.assistantMessageId }
        : {}),
      conversationId: input.conversationId,
      message: {
        parts: input.parts,
      },
      session: input.session,
    },
    method: "POST",
    path: "/api/internal/runtime/workspace-chat/messages/complete",
  });
}

export async function sendWorkspaceChatFailure(input) {
  return await requestControlPlane({
    body: {
      ...(input.assistantDisplayName
        ? { assistantDisplayName: input.assistantDisplayName }
        : {}),
      ...(input.assistantMessageId
        ? { assistantMessageId: input.assistantMessageId }
        : {}),
      conversationId: input.conversationId,
      ...(input.error ? { error: input.error } : {}),
    },
    method: "POST",
    path: "/api/internal/runtime/workspace-chat/messages/fail",
  });
}

export async function sendWorkspaceChatActivityEvent(input) {
  return await requestControlPlane({
    body: {
      assistantMessageId: input.assistantMessageId,
      conversationId: input.conversationId,
      event: input.event,
    },
    method: "POST",
    path: "/api/internal/runtime/workspace-chat/messages/events",
  });
}

async function requestControlPlane(input) {
  const baseUrl = resolveControlPlaneBaseUrl();
  const token = resolveTenantToken();

  if (!baseUrl) {
    throw new Error(
      "OTTO_CONTROL_PLANE_BASE_URL is not set in the runtime environment.",
    );
  }

  if (!token) {
    throw new Error("TENANT_TOKEN is not set in the runtime environment.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const requestUrl = `${baseUrl}${input.path}`;

  console.info("[workspace-chat] control-plane callback request starting", {
    bodyKeys: input.body ? Object.keys(input.body) : [],
    method: input.method,
    path: input.path,
  });

  try {
    const response = await fetch(requestUrl, {
      body: input.body ? JSON.stringify(input.body) : undefined,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: input.method,
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      console.error("[workspace-chat] control-plane callback request failed", {
        error:
          payload?.error ||
          `Workspace chat workspace API request failed with status ${response.status}.`,
        method: input.method,
        path: input.path,
        status: response.status,
      });
      throw new Error(
        payload?.error ||
          `Workspace chat workspace API request failed with status ${response.status}.`,
      );
    }

    console.info("[workspace-chat] control-plane callback request succeeded", {
      method: input.method,
      path: input.path,
      status: response.status,
    });

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveControlPlaneBaseUrl() {
  const raw = process.env.OTTO_CONTROL_PLANE_BASE_URL ?? "";
  const value = raw.trim().replace(/\/+$/u, "");
  return value || null;
}

function resolveTenantToken() {
  const raw = process.env.TENANT_TOKEN ?? "";
  const value = raw.trim();
  return value || null;
}
