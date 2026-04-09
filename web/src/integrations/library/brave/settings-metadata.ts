import type { AgentCapability } from "@/lib/agent-capabilities";

export const braveAgentCapabilities: AgentCapability[] = [
  {
    description:
      "Otto can inspect the current workspace-managed Brave web-search defaults.",
    direction: "read",
    key: "brave:read:config",
    label: "Read Brave search defaults",
    source: "base",
  },
  {
    conditionNote:
      "Requires the workspace app to have a managed Brave web-search provider configured.",
    description: "Otto can search the web using the managed Brave provider.",
    direction: "tool",
    key: "brave:tool:web_search",
    label: "Search the web",
    openclawTool: "web_search",
    source: "conditional",
  },
];

export const braveFieldMeanings = [
  {
    description:
      "The managed web-search provider selected by the workspace app.",
    key: "provider",
    label: "Provider",
  },
  {
    description:
      "The runtime environment variable the workspace app uses for the provider credential. The secret value is never exposed here.",
    key: "credentialEnvVar",
    label: "Credential env var",
  },
  {
    description: "Default result count passed to OpenClaw for web search.",
    key: "maxResults",
    label: "Default results",
  },
  {
    description: "Request timeout projected for managed web search.",
    key: "timeoutSeconds",
    label: "Timeout",
  },
  {
    description: "Cache lifetime for managed web-search results.",
    key: "cacheTtlMinutes",
    label: "Cache TTL",
  },
  {
    description: "Managed Brave mode for structured search responses.",
    key: "braveMode",
    label: "Brave mode",
  },
  {
    description: "How this integration is managed.",
    key: "managedBy",
    label: "Managed by",
  },
] as const;

export const braveSettingsExamples = [
  {
    action: "get" as const,
    description:
      "Inspect the current Brave provider defaults and status. Brave is platform-managed and read-only in the workspace.",
  },
];
