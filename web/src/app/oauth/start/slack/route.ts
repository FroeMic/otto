import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getOnboardingDraftForUser } from "@/db/control-plane";
import { signOAuthState } from "@/lib/crypto";
import { hasSlackOAuthConfig } from "@/lib/env";
import { buildSlackInstallUrl } from "@/lib/slack";

export async function GET(request: Request) {
  const { user } = await withAuth({ ensureSignedIn: true });

  if (!hasSlackOAuthConfig()) {
    return NextResponse.json(
      { error: "Slack OAuth is not configured" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const onboardingSessionId = url.searchParams.get("onboardingSessionId");

  if (!onboardingSessionId) {
    return NextResponse.json(
      { error: "onboardingSessionId is required" },
      { status: 400 },
    );
  }

  const onboardingSession = await getOnboardingDraftForUser({
    onboardingSessionId,
    userExternalId: user.id,
  });

  if (
    onboardingSession.tenantId &&
    onboardingSession.tenantStatus === "ready" &&
    onboardingSession.serverStatus === "ready"
  ) {
    return NextResponse.redirect(
      new URL(
        `/${onboardingSession.organizationSlug}/integrations/slack?slack_error=${encodeURIComponent("Slack reconnect after Otto is ready is not available yet.")}`,
        request.url,
      ),
    );
  }

  const state = signOAuthState({
    onboardingSessionId,
    orgSlug: onboardingSession.organizationSlug,
    userExternalId: user.id,
  });

  return NextResponse.redirect(buildSlackInstallUrl(state));
}
