export function buildSlackWorkspaceOauthStartUrl(input: {
  hasSlackOAuthConfig: boolean;
  orgSlug: string | null;
}) {
  if (!input.hasSlackOAuthConfig || !input.orgSlug) {
    return null;
  }

  return `/oauth/start/integration/slack?orgSlug=${encodeURIComponent(input.orgSlug)}`;
}

export function buildSlackOnboardingOauthStartUrl(input: {
  hasSlackOAuthConfig: boolean;
  onboardingSessionId: string | null;
}) {
  if (!input.hasSlackOAuthConfig || !input.onboardingSessionId) {
    return null;
  }

  return `/oauth/start/integration/slack?onboardingSessionId=${encodeURIComponent(input.onboardingSessionId)}`;
}
