export function normalizeWorkspaceTarget(raw) {
  if (typeof raw !== "string") {
    return "";
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("workspace:") ? trimmed : `workspace:${trimmed}`;
}

export function buildWorkspaceTarget(input) {
  const base = normalizeWorkspaceTarget(input.conversationId);
  const params = new URLSearchParams();

  if (input.conversationVisibility === "personal") {
    params.set("visibility", "personal");
  }

  const query = params.toString();

  if (!query) {
    return base;
  }

  return `${base}?${query}`;
}

export function parseWorkspaceTarget(raw) {
  const target = normalizeWorkspaceTarget(raw);
  const [conversationId, query = ""] = target.replace(/^workspace:/u, "").split("?", 2);
  const params = new URLSearchParams(query);
  const assistantMessageId = params.get("assistantMessageId")?.trim() || undefined;
  const conversationVisibility =
    params.get("visibility")?.trim() === "personal" ? "personal" : "open";

  if (!conversationId) {
    throw new Error("Workspace chat target must include a conversation id.");
  }

  return {
    assistantMessageId,
    conversationId,
    conversationVisibility,
    target,
  };
}

export function inferWorkspaceTargetChatType(raw) {
  return parseWorkspaceTarget(raw).conversationVisibility === "personal"
    ? "direct"
    : "group";
}
