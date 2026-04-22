export interface ParsedSessionKey {
  agentId: string
  id: string | null
  kind: "dm" | "channel" | "group" | "thread" | "main" | "unknown"
  provider: string | null
  threadId: string | null
}

export function parseSessionKey(sessionKey: string): ParsedSessionKey {
  const parts = sessionKey.split(":")
  const agentId = parts[1] ?? "main"

  if (parts.length <= 3 && parts[2] === "main") {
    return {
      agentId,
      id: null,
      kind: "main",
      provider: null,
      threadId: null,
    }
  }

  const provider = parts[2] ?? null
  const kindRaw = parts[3] ?? "unknown"
  const kind = (
    kindRaw === "direct"
      ? "dm"
      : ["dm", "channel", "group"].includes(kindRaw)
        ? kindRaw
        : "unknown"
  ) as ParsedSessionKey["kind"]
  const threadIdx = parts.indexOf("thread")
  const threadId =
    threadIdx !== -1 ? parts.slice(threadIdx + 1).join(":") : null
  const idEnd = threadIdx !== -1 ? threadIdx : parts.length
  const id = parts.slice(4, idEnd).join(":") || null
  const effectiveKind = threadId ? "thread" : kind

  return { agentId, id, kind: effectiveKind, provider, threadId }
}

const providerLabels: Record<string, string> = {
  cron: "Scheduled Task",
  discord: "Discord",
  slack: "Slack",
  telegram: "Telegram",
}

const providerIcons: Record<string, string> = {
  slack: "/integrations/slack.svg",
}

export function getProviderIcon(provider: string | null): string | null {
  if (!provider) {
    return null
  }

  return providerIcons[provider] ?? null
}

export function getProviderLabel(provider: string | null) {
  if (!provider) {
    return "Agent"
  }

  return providerLabels[provider] ?? provider
}

function resolveIdName(
  id: string | null,
  nameMaps?: {
    channels?: Map<string, string>
    members?: Map<string, string>
  },
) {
  if (!id || !nameMaps) {
    return null
  }

  return (
    nameMaps.channels?.get(id) ??
    nameMaps.channels?.get(id.toLowerCase()) ??
    nameMaps.channels?.get(id.toUpperCase()) ??
    nameMaps.members?.get(id) ??
    nameMaps.members?.get(id.toLowerCase()) ??
    nameMaps.members?.get(id.toUpperCase()) ??
    null
  )
}

export function formatSessionName(input: {
  chatType?: string | null
  displayName?: string | null
  label?: string | null
  nameMaps?: {
    channels?: Map<string, string>
    members?: Map<string, string>
  }
  originFrom?: string | null
  sessionKey: string
  subject?: string | null
}) {
  const parsed = parseSessionKey(input.sessionKey)
  const resolvedName = resolveIdName(parsed.id, input.nameMaps)

  if (parsed.provider === "cron") {
    if (input.displayName) {
      return input.displayName.length > 60
        ? `${input.displayName.slice(0, 60)}...`
        : input.displayName
    }

    if (input.label) {
      return input.label
    }

    return "Scheduled Task Run"
  }

  if (parsed.kind === "thread" && input.displayName) {
    const threadMatch = input.displayName.match(/Slack thread (#\S+):\s*(.*)/)

    if (threadMatch) {
      const channel = threadMatch[1]
      const topic =
        threadMatch[2].length > 50
          ? `${threadMatch[2].slice(0, 50)}...`
          : threadMatch[2]

      return `${channel} thread: ${topic}`
    }

    return input.displayName.length > 60
      ? `${input.displayName.slice(0, 60)}...`
      : input.displayName
  }

  switch (parsed.kind) {
    case "main":
      return "Heartbeat Session"

    case "dm": {
      if (input.subject) return `DM: ${input.subject}`
      if (input.label) return `DM: ${input.label}`
      if (resolvedName) return `DM: ${resolvedName}`

      return `DM: ${parsed.id ?? "unknown"}`
    }

    case "channel": {
      if (resolvedName) return `#${resolvedName}`
      if (input.subject) return `#${input.subject}`
      if (input.label) return `#${input.label}`

      return `#${parsed.id ?? "unknown"}`
    }

    case "group": {
      if (resolvedName) return resolvedName
      if (input.subject) return input.subject
      if (input.label) return input.label

      return `Group: ${parsed.id ?? "unknown"}`
    }

    case "thread": {
      const channelName = resolvedName
        ? `#${resolvedName}`
        : `#${parsed.id ?? "unknown"}`

      return `${channelName} (thread)`
    }

    default:
      return (
        input.displayName ?? input.label ?? input.subject ?? input.sessionKey
      )
  }
}

export function canViewSessionDetail(input: {
  currentUserExternalIds: string[]
  isPlatformAdmin: boolean
  sessionKey: string
}) {
  if (input.isPlatformAdmin) {
    return true
  }

  const parsed = parseSessionKey(input.sessionKey)

  if (parsed.kind !== "dm" && parsed.kind !== "main") {
    return true
  }

  if (parsed.kind === "dm" && parsed.id) {
    const parsedId = parsed.id.toLowerCase()

    return input.currentUserExternalIds.some(
      (externalId) => externalId.toLowerCase() === parsedId,
    )
  }

  if (parsed.kind === "main") {
    return false
  }

  return true
}
