const CHANNEL_ID = "otto-workspace-chat";
const DEFAULT_TIMEOUT_MS = 15_000;

export async function sendWorkspaceChatText({
  text,
  to,
}) {
  const target = parseWorkspaceTarget(to);
  const response = await requestControlPlane({
    body: {
      assistantDisplayName: "Otto",
      conversationId: target.conversationId,
      message: {
        parts: [
          {
            text,
            type: "text",
          },
        ],
      },
      session: {
        sessionKey: target.target,
        status: "completed",
      },
    },
    method: "POST",
    path: "/api/internal/runtime/workspace-chat/messages/complete",
  });

  return {
    channel: CHANNEL_ID,
    messageId: response.messageId,
  };
}

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
  const target = normalizeWorkspaceTarget(raw);
  const conversationId = target.replace(/^workspace:/, "");

  if (!conversationId) {
    throw new Error("Workspace chat target must include a conversation id.");
  }

  return {
    conversationId,
    target,
  };
}

function resolveControlPlaneBaseUrl() {
  const raw = process.env.OTTO_CONTROL_PLANE_BASE_URL ?? "";
  const value = raw.trim().replace(/\/+$/, "");
  return value || null;
}

function resolveTenantToken() {
  const raw = process.env.TENANT_TOKEN ?? "";
  const value = raw.trim();
  return value || null;
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

  try {
    const response = await fetch(`${baseUrl}${input.path}`, {
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
      throw new Error(
        payload?.error ||
          `Workspace chat workspace API request failed with status ${response.status}.`,
      );
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}
