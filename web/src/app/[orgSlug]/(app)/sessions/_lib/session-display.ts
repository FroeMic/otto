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
  const kind = (["dm", "channel", "group"].includes(kindRaw) ? kindRaw : "unknown") as ParsedSessionKey["kind"];

  // Find thread part
  const threadIdx = parts.indexOf("thread");
  const threadId = threadIdx !== -1 ? parts.slice(threadIdx + 1).join(":") : null;

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
}): string {
  const parsed = parseSessionKey(input.sessionKey);

  // If we have a displayName from the session metadata, use it for threads
  // as it usually contains the thread topic (e.g., "Slack thread #new-channel: topic")
  if (parsed.kind === "thread" && input.displayName) {
    // Clean up the display name — extract the meaningful part
    const threadMatch = input.displayName.match(
      /Slack thread (#\S+):\s*(.*)/,
    );
    if (threadMatch) {
      const channel = threadMatch[1];
      const topic = threadMatch[2].length > 50
        ? threadMatch[2].slice(0, 50) + "..."
        : threadMatch[2];
      return `${channel} thread: ${topic}`;
    }
    return input.displayName.length > 60
      ? input.displayName.slice(0, 60) + "..."
      : input.displayName;
  }

  switch (parsed.kind) {
    case "main":
      return "Shared DMs (legacy)";

    case "dm": {
      // Try to use subject or label for a contact name
      if (input.subject) return `DM: ${input.subject}`;
      if (input.label) return `DM: ${input.label}`;
      // Fall back to the raw ID
      const id = parsed.id ?? "unknown";
      return `DM: ${id}`;
    }

    case "channel": {
      if (input.subject) return `#${input.subject}`;
      if (input.label) return `#${input.label}`;
      const channelId = parsed.id ?? "unknown";
      return `#${channelId}`;
    }

    case "group": {
      if (input.subject) return input.subject;
      if (input.label) return input.label;
      const groupId = parsed.id ?? "unknown";
      return `Group: ${groupId}`;
    }

    case "thread": {
      if (input.displayName) {
        return input.displayName.length > 60
          ? input.displayName.slice(0, 60) + "..."
          : input.displayName;
      }
      const channelId = parsed.id ?? "unknown";
      return `#${channelId} (thread)`;
    }

    default: {
      // Use whatever metadata we have
      return (
        input.displayName ??
        input.label ??
        input.subject ??
        input.sessionKey
      );
    }
  }
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
  // Platform admins always have access
  if (input.isPlatformAdmin) return true;

  const parsed = parseSessionKey(input.sessionKey);

  // Non-DM sessions (channels, groups, threads) are visible to all org members
  if (parsed.kind !== "dm" && parsed.kind !== "main") return true;

  // For DMs: check if the current user is the DM owner
  if (parsed.kind === "dm" && parsed.id) {
    return input.currentUserExternalIds.some(
      (id) => id.toLowerCase() === parsed.id!.toLowerCase(),
    );
  }

  // Legacy shared DMs — platform admin only (already handled above)
  // For non-admins viewing shared DM, deny
  if (parsed.kind === "main") return false;

  return true;
}
