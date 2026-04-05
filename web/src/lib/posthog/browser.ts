import posthog from "posthog-js";

const DEFAULT_POSTHOG_HOST = "/ingest";
const DEFAULT_POSTHOG_UI_HOST = "https://eu.posthog.com";

export type PostHogUserIdentity = {
  email: string;
  id: string;
  name: string;
};

export function isPostHogBrowserAnalyticsEnabled() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_TOKEN)
  );
}

export function initPostHogBrowserAnalytics() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN;

  if (!isPostHogBrowserAnalyticsEnabled() || !token) {
    return;
  }

  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
    autocapture: false,
    capture_pageleave: false,
    capture_pageview: "history_change",
    defaults: "2026-01-30",
    disable_session_recording: true,
    disable_surveys: true,
    enable_heatmaps: false,
    person_profiles: "identified_only",
    ui_host: DEFAULT_POSTHOG_UI_HOST,
  });
}

export function identifyPostHogBrowserUser(user: PostHogUserIdentity) {
  if (!isPostHogBrowserAnalyticsEnabled()) {
    return;
  }

  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
  });
}

export function resetPostHogBrowserAnalytics() {
  if (!isPostHogBrowserAnalyticsEnabled()) {
    return;
  }

  posthog.reset();
}
