export function buildSlackWorkspaceOauthStartUrl(input: {
  hasSlackOAuthConfig: boolean;
  orgSlug: string | null;
}) {
  if (!input.hasSlackOAuthConfig || !input.orgSlug) {
    return null;
  }

  return `/oauth/start/integration/slack?orgSlug=${encodeURIComponent(input.orgSlug)}`;
}
