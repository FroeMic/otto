export interface BraveConfigRow {
  description?: string
  title: string
  value: string
}

export interface BraveRuntimeConfig {
  braveMode?: string
  cacheTtlMinutes?: number
  credentialEnvVar?: string | null
  geminiModel?: string
  grokInlineCitations?: boolean
  grokModel?: string
  kimiBaseUrl?: string
  kimiModel?: string
  managedBy?: string | null
  maxResults?: number
  perplexityBaseUrl?: string
  perplexityModel?: string
  provider?: string | null
  timeoutSeconds?: number
}

export function formatBraveProviderLabel(provider: string | null | undefined) {
  switch (provider) {
    case "brave":
      return "Brave"
    case "gemini":
      return "Gemini"
    case "grok":
      return "Grok"
    case "kimi":
      return "Kimi"
    case "perplexity":
      return "Perplexity"
    default:
      return "Not configured"
  }
}

export function formatBraveManagedByLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown"
  }

  if (value === "control_plane_env") {
    return "Workspace defaults"
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

export function formatBraveAvailabilityLabel(
  availability: "available" | "blocked" | undefined,
) {
  return availability === "available" ? "Available" : "Unavailable"
}

export function buildBraveDefaultRows(
  config: BraveRuntimeConfig,
): BraveConfigRow[] {
  return [
    {
      title: "Default results",
      value:
        config.maxResults !== undefined
          ? String(config.maxResults)
          : "Workspace default",
    },
    {
      title: "Timeout",
      value:
        config.timeoutSeconds !== undefined
          ? `${config.timeoutSeconds}s`
          : "Workspace default",
    },
    {
      title: "Cache TTL",
      value:
        config.cacheTtlMinutes !== undefined
          ? `${config.cacheTtlMinutes} min`
          : "Workspace default",
    },
  ]
}

export function buildBraveProviderRows(
  config: BraveRuntimeConfig,
): BraveConfigRow[] {
  const rows: BraveConfigRow[] = [
    {
      description: "The workspace keeps the provider API key in this env var.",
      title: "API key env var",
      value: config.credentialEnvVar ?? "Not exposed",
    },
  ]

  if (config.provider === "brave" || config.braveMode) {
    rows.push({
      title: "Brave mode",
      value: config.braveMode ?? "Workspace default",
    })
  }

  if (config.provider === "gemini" || config.geminiModel) {
    rows.push({
      title: "Gemini model",
      value: config.geminiModel ?? "Workspace default",
    })
  }

  if (
    config.provider === "grok" ||
    config.grokModel ||
    config.grokInlineCitations !== undefined
  ) {
    rows.push({
      title: "Grok model",
      value: config.grokModel ?? "Workspace default",
    })
    rows.push({
      title: "Grok inline citations",
      value: config.grokInlineCitations ? "Enabled" : "Disabled",
    })
  }

  if (config.provider === "kimi" || config.kimiModel || config.kimiBaseUrl) {
    rows.push({
      title: "Kimi model",
      value: config.kimiModel ?? "Workspace default",
    })
    rows.push({
      title: "Kimi base URL",
      value: config.kimiBaseUrl ?? "Workspace default",
    })
  }

  if (
    config.provider === "perplexity" ||
    config.perplexityModel ||
    config.perplexityBaseUrl
  ) {
    rows.push({
      title: "Perplexity model",
      value: config.perplexityModel ?? "Workspace default",
    })
    rows.push({
      title: "Perplexity base URL",
      value: config.perplexityBaseUrl ?? "Workspace default",
    })
  }

  return rows
}
