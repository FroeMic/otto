import {
  type BrowserPostHogConfig,
  DEFAULT_POSTHOG_BROWSER_API_HOST,
  DEFAULT_POSTHOG_UI_HOST,
} from "../shared/posthog"
import type { FrontendEnv } from "./env"

export function getBrowserPostHogConfig(
  env: FrontendEnv,
): BrowserPostHogConfig | null {
  if (
    env.NODE_ENV !== "production" ||
    !env.NEXT_PUBLIC_POSTHOG_ENABLED ||
    !env.NEXT_PUBLIC_POSTHOG_TOKEN
  ) {
    return null
  }

  return {
    apiHost: env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_BROWSER_API_HOST,
    enabled: true,
    token: env.NEXT_PUBLIC_POSTHOG_TOKEN,
    uiHost: DEFAULT_POSTHOG_UI_HOST,
  }
}

export function serializeBrowserPostHogConfig(
  config: BrowserPostHogConfig | null,
) {
  if (!config) {
    return null
  }

  return JSON.stringify(config).replace(/</g, "\\u003c")
}
