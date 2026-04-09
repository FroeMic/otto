import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  getOnboardingDraftForUser,
  getTenantManagedIntegrationConnectContext,
} from "../../../../../db/control-plane";
import { getIntegrationDefinition } from "../../../../../integrations/framework";
import { signSlackOnboardingOAuthState } from "../../../../../integrations/library/slack/oauth/onboarding-state";
import {
  getControlPlaneBaseUrl,
  hasLinearOAuthConfig,
  hasSlackOAuthConfig,
} from "../../../../../lib/env";
import { createManagedIntegrationOauthAuthorizationUrl } from "../../../../../lib/oauth/service";
import { buildSlackInstallUrl } from "../../../../../lib/slack";
import { getPendingAccessPath } from "../../../../../lib/workspace";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      provider: string;
    }>;
  },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const url = new URL(request.url);
  const redirectBaseUrl = getControlPlaneBaseUrl() || request.url;
  const { provider } = await context.params;
  const providerKey = provider.trim().toLowerCase();
  const orgSlug = url.searchParams.get("orgSlug");
  const onboardingSessionId = url.searchParams.get("onboardingSessionId");
  const definition = orgSlug ? getIntegrationDefinition(providerKey) : null;
  const fallbackPath =
    orgSlug && definition ? definition.settingsPath(orgSlug) : "/login";

  try {
    if (!orgSlug) {
      throw new Error("Missing workspace slug.");
    }

    if (providerKey === "linear" && !hasLinearOAuthConfig()) {
      throw new Error("Linear is not available right now.");
    }

    if (providerKey === "slack" && !hasSlackOAuthConfig()) {
      throw new Error("Slack is not available right now.");
    }

    if (providerKey === "slack" && onboardingSessionId) {
      const onboardingSession = await getOnboardingDraftForUser({
        onboardingSessionId,
        userExternalId: user.id,
      });

      if (!onboardingSession.organizationIsReady) {
        return NextResponse.redirect(
          new URL(
            getPendingAccessPath(onboardingSession.organizationSlug),
            redirectBaseUrl,
          ),
        );
      }

      const state = signSlackOnboardingOAuthState({
        onboardingSessionId,
        orgSlug: onboardingSession.organizationSlug,
        userExternalId: user.id,
      });

      return NextResponse.redirect(buildSlackInstallUrl(state));
    }

    const connectContext = await getTenantManagedIntegrationConnectContext({
      orgSlug,
      providerKey,
      userExternalId: user.id,
    });

    if (!connectContext) {
      throw new Error("This workspace is not available.");
    }

    const authorization = await createManagedIntegrationOauthAuthorizationUrl({
      mode:
        connectContext.integrationStatus === "connected"
          ? "reconnect"
          : "connect",
      organizationId: connectContext.organizationId,
      providerKey,
      tenantId: connectContext.tenantId,
      tenantIntegrationId: connectContext.tenantIntegrationId,
      userId: connectContext.userId,
    });

    return NextResponse.redirect(authorization.authorizeUrl);
  } catch (error) {
    const onboardingFallbackPath =
      providerKey === "slack" && onboardingSessionId
        ? orgSlug
          ? `/${orgSlug}/onboarding`
          : "/login"
        : fallbackPath;

    return NextResponse.redirect(
      new URL(
        `${onboardingFallbackPath}?${providerKey}_error=${encodeURIComponent(getErrorMessage(error))}`,
        redirectBaseUrl,
      ),
    );
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The integration could not be opened right now.";
}
