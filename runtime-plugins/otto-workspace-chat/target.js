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

export function parseWorkspaceTarget(raw) {
  const target = normalizeWorkspaceTarget(raw);
  const [conversationId, query = ""] = target.replace(/^workspace:/u, "").split("?", 2);
  const assistantMessageId =
    new URLSearchParams(query).get("assistantMessageId")?.trim() || undefined;

  if (!conversationId) {
    throw new Error("Workspace chat target must include a conversation id.");
  }

  return {
    assistantMessageId,
    conversationId,
    target,
  };
}
