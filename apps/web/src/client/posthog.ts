import posthog from "posthog-js"

import {
  DEFAULT_POSTHOG_BROWSER_API_HOST,
  type BrowserPostHogConfig,
  type BrowserPostHogUserIdentity,
  isBrowserPostHogConfigEnabled,
} from "@/shared/posthog"

declare global {
  interface Window {
    __OTTO_POSTHOG__?: BrowserPostHogConfig
  }
}

let hasInitializedPostHog = false

export function getWindowPostHogConfig() {
  if (typeof window === "undefined") {
    return null
  }

  const config = window.__OTTO_POSTHOG__

  if (!config || !isBrowserPostHogConfigEnabled(config)) {
    return null
  }

  return {
    ...config,
    apiHost: config.apiHost || DEFAULT_POSTHOG_BROWSER_API_HOST,
  }
}

export function initPostHogBrowserAnalytics() {
  const config = getWindowPostHogConfig()

  if (!config || hasInitializedPostHog) {
    return false
  }

  posthog.init(config.token, {
    api_host: config.apiHost,
    autocapture: false,
    capture_pageleave: false,
    capture_pageview: "history_change",
    defaults: "2026-01-30",
    disable_session_recording: true,
    disable_surveys: true,
    enable_heatmaps: false,
    person_profiles: "identified_only",
    ui_host: config.uiHost,
  })

  hasInitializedPostHog = true

  return true
}

export function identifyPostHogBrowserUser(user: BrowserPostHogUserIdentity) {
  if (!getWindowPostHogConfig()) {
    return
  }

  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
    workspaceId: user.workspaceId,
    workspaceName: user.workspaceName,
    workspaceSlug: user.workspaceSlug,
  })
}

export function capturePostHogBrowserEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  if (!getWindowPostHogConfig()) {
    return
  }

  posthog.capture(eventName, properties)
}
