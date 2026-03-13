import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { completeSlackOnboardingAndProvision } from "@/db/control-plane";
import { verifyOAuthState } from "@/lib/crypto";
import { exchangeSlackCodeForBotToken } from "@/lib/slack";

type SlackOAuthState = {
  onboardingSessionId: string;
  userExternalId: string;
};

export async function GET(request: Request) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?slack_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing Slack OAuth code or state" },
      { status: 400 },
    );
  }

  const decodedState = verifyOAuthState<SlackOAuthState>(state);

  if (decodedState.userExternalId !== user.id) {
    return NextResponse.json(
      { error: "Slack OAuth state does not match the signed-in user" },
      { status: 403 },
    );
  }

  const installation = await exchangeSlackCodeForBotToken(code);

  await completeSlackOnboardingAndProvision({
    botToken: installation.botToken,
    installerUserId: installation.installerUserId,
    onboardingSessionId: decodedState.onboardingSessionId,
    scopeCsv: installation.scopeCsv,
    slackBotUserId: installation.slackBotUserId,
    slackTeamId: installation.teamId,
    slackTeamName: installation.teamName,
    userExternalId: user.id,
  });

  return NextResponse.redirect(new URL("/?slack_connected=1", request.url));
}
