export function buildSlackWorkspaceOauthStartUrl(input: {
  hasSlackOAuthConfig: boolean;
  onboardingSessionId: string | null;
}) {
  if (!input.hasSlackOAuthConfig || !input.onboardingSessionId) {
    return null;
  }

  return `/oauth/start/slack?onboardingSessionId=${encodeURIComponent(input.onboardingSessionId)}`;
}
