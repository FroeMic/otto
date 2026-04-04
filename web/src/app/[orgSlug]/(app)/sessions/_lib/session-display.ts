/**
 * Parse an OpenClaw session key into structured parts and derive
 * a human-readable display name.
 *
 * Session key patterns:
 *   agent:main:main                                           → shared DM (legacy)
 *   agent:main:slack:channel:c0aky040d3m:thread:1775227708    → Slack channel thread
 *   agent:main:slack:dm:u0alyk6qz8q                           → Slack DM
 *   agent:main:slack:group:g123                                → Slack group
 *   agent:main:whatsapp:group:123456@g.us                     → WhatsApp group
 *   agent:main:whatsapp:dm:+4917656843172                     → WhatsApp DM
 */

export type ParsedSessionKey = {
  agentId: string;
  provider: string | null;
  kind: "dm" | "channel" | "group" | "thread" | "main" | "unknown";
  id: string | null;
  threadId: string | null;
};

export function parseSessionKey(sessionKey: string): ParsedSessionKey {
  const parts = sessionKey.split(":");

  // agent:<agentId>:...
  const agentId = parts[1] ?? "main";

  // agent:main:main → legacy shared DM
  if (parts.length <= 3 && parts[2] === "main") {
    return { agentId, provider: null, kind: "main", id: null, threadId: null };
  }

  // agent:main:<provider>:<kind>:<id>[:thread:<threadId>]
  const provider = parts[2] ?? null;
  const kindRaw = parts[3] ?? "unknown";
  const kind = (
    ["dm", "channel", "group"].includes(kindRaw) ? kindRaw : "unknown"
  ) as ParsedSessionKey["kind"];

  // Find thread part
  const threadIdx = parts.indexOf("thread");
  const threadId =
    threadIdx !== -1 ? parts.slice(threadIdx + 1).join(":") : null;

  // ID is everything between kind and thread (or end)
  const idEnd = threadIdx !== -1 ? threadIdx : parts.length;
  const id = parts.slice(4, idEnd).join(":") || null;

  // If we have a thread, mark as thread kind
  const effectiveKind = threadId ? "thread" : kind;

  return { agentId, provider, kind: effectiveKind, id, threadId };
}

const providerLabels: Record<string, string> = {
  slack: "Slack",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  cron: "Scheduled Task",
};

const providerIcons: Record<string, string> = {
  slack: "/integrations/slack.svg",
  whatsapp: "/integrations/whatsapp.png",
};

export function getProviderIcon(provider: string | null): string | null {
  if (!provider) return null;
  return providerIcons[provider] ?? null;
}

export function getProviderLabel(provider: string | null): string {
  if (!provider) return "Agent";
  return providerLabels[provider] ?? provider;
}

/**
 * Resolve an ID from the session key to a human-readable name
 * using lookup maps (channel names, member names).
 */
function resolveIdName(
  id: string | null,
  nameMaps?: { channels?: Map<string, string>; members?: Map<string, string> },
): string | null {
  if (!id || !nameMaps) return null;
  // Try channels first (for channel/thread keys), then members (for DM keys)
  return (
    nameMaps.channels?.get(id) ??
    nameMaps.channels?.get(id.toLowerCase()) ??
    nameMaps.channels?.get(id.toUpperCase()) ??
    nameMaps.members?.get(id) ??
    nameMaps.members?.get(id.toLowerCase()) ??
    nameMaps.members?.get(id.toUpperCase()) ??
    null
  );
}

/**
 * Build a human-readable session name from the session key and
 * optional metadata from the session entry.
 */
export function formatSessionName(input: {
  sessionKey: string;
  displayName?: string | null;
  label?: string | null;
  subject?: string | null;
  originFrom?: string | null;
  chatType?: string | null;
  nameMaps?: { channels?: Map<string, string>; members?: Map<string, string> };
}): string {
  const parsed = parseSessionKey(input.sessionKey);
  const resolvedName = resolveIdName(parsed.id, input.nameMaps);

  // Cron / scheduled task sessions
  if (parsed.provider === "cron") {
    if (input.displayName) {
      return input.displayName.length > 60
        ? `${input.displayName.slice(0, 60)}...`
        : input.displayName;
    }
    if (input.label) return input.label;
    return `Scheduled Task Run`;
  }

  // For threads, try to use displayName which contains the thread topic
  if (parsed.kind === "thread" && input.displayName) {
    const threadMatch = input.displayName.match(/Slack thread (#\S+):\s*(.*)/);
    if (threadMatch) {
      const channel = threadMatch[1];
      const topic =
        threadMatch[2].length > 50
          ? `${threadMatch[2].slice(0, 50)}...`
          : threadMatch[2];
      return `${channel} thread: ${topic}`;
    }
    return input.displayName.length > 60
      ? `${input.displayName.slice(0, 60)}...`
      : input.displayName;
  }

  switch (parsed.kind) {
    case "main":
      return "Shared DMs (legacy)";

    case "dm": {
      if (input.subject) return `DM: ${input.subject}`;
      if (input.label) return `DM: ${input.label}`;
      if (resolvedName) return `DM: ${resolvedName}`;
      const id = parsed.id ?? "unknown";
      return `DM: ${id}`;
    }

    case "channel": {
      if (resolvedName) return `#${resolvedName}`;
      if (input.subject) return `#${input.subject}`;
      if (input.label) return `#${input.label}`;
      const channelId = parsed.id ?? "unknown";
      return `#${channelId}`;
    }

    case "group": {
      if (resolvedName) return resolvedName;
      if (input.subject) return input.subject;
      if (input.label) return input.label;
      const groupId = parsed.id ?? "unknown";
      return `Group: ${groupId}`;
    }

    case "thread": {
      // Resolve the channel ID in the thread key
      const channelName = resolvedName
        ? `#${resolvedName}`
        : `#${parsed.id ?? "unknown"}`;
      return `${channelName} (thread)`;
    }

    default: {
      return (
        input.displayName ?? input.label ?? input.subject ?? input.sessionKey
      );
    }
  }
}

/**
 * Get the scheduled task link for a cron session, if applicable.
 * Uses the cronTaskKeys map (session key → task key) to find the correct task.
 */
export function getScheduledTaskHref(
  sessionKey: string,
  orgSlug: string,
  cronTaskKeys?: Record<string, string>,
): string | null {
  const parsed = parseSessionKey(sessionKey);
  if (parsed.provider !== "cron") return null;

  // Look up the task key from the map (session key → task key)
  const taskKey = cronTaskKeys?.[sessionKey];
  if (taskKey) {
    return `/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(taskKey)}`;
  }

  return null;
}

/**
 * Determine if the current user can view the full session transcript.
 *
 * For DMs: only the DM owner (matched via external IDs) or platform admins.
 * For channels/groups/threads: any org member.
 */
export function canViewSessionDetail(input: {
  sessionKey: string;
  currentUserExternalIds: string[];
  isPlatformAdmin: boolean;
  sessionOriginFrom?: string | null;
}): boolean {
  if (input.isPlatformAdmin) return true;

  const parsed = parseSessionKey(input.sessionKey);

  if (parsed.kind !== "dm" && parsed.kind !== "main") return true;

  if (parsed.kind === "dm" && parsed.id) {
    const parsedId = parsed.id.toLowerCase();
    return input.currentUserExternalIds.some(
      (id) => id.toLowerCase() === parsedId,
    );
  }

  if (parsed.kind === "main") return false;

  return true;
}
