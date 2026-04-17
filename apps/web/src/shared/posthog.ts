export const DEFAULT_POSTHOG_BROWSER_API_HOST = "/ingest"
export const DEFAULT_POSTHOG_UI_HOST = "https://eu.posthog.com"

export interface BrowserPostHogConfig {
  apiHost: string
  enabled: boolean
  token: string
  uiHost: string
}

export interface BrowserPostHogUserIdentity {
  email: string
  id: string
  name: string
  workspaceId?: string
  workspaceName?: string
  workspaceSlug?: string
}

export function isBrowserPostHogConfigEnabled(
  config: BrowserPostHogConfig | null | undefined,
) {
  return Boolean(config?.enabled && config.token)
}
