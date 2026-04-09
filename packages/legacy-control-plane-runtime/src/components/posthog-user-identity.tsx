"use client";

import { useEffect } from "react";

import {
  identifyPostHogBrowserUser,
  type PostHogUserIdentity as PostHogBrowserUserIdentity,
} from "../lib/posthog/browser";

export function PostHogUserIdentity({
  user: { email, id, name },
}: {
  user: PostHogBrowserUserIdentity;
}) {
  useEffect(() => {
    identifyPostHogBrowserUser({ email, id, name });
  }, [email, id, name]);

  return null;
}
