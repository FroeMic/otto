import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  completeSlackOnboardingAndProvision,
  recordMessagingWorkspaceSyncFailure,
  recordSlackOauthFailure,
  syncMessagingDirectoryForTenantIntegration,
} from "@/db/control-plane";
import { verifyOAuthState } from "@/lib/crypto";
import {
  exchangeSlackCodeForBotToken,
  fetchSlackMessagingDirectory,
} from "@/lib/slack";

type SlackOAuthState = {
  onboardingSessionId: string;
  orgSlug: string;
  userExternalId: string;
};

export async function GET(request: Request) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  let decodedState: SlackOAuthState | null = null;

  if (state) {
    try {
      decodedState = verifyOAuthState<SlackOAuthState>(state);
    } catch {
      decodedState = null;
    }
  }

  if (error) {
    if (decodedState) {
      await recordSlackOauthFailure({
        error,
        onboardingSessionId: decodedState.onboardingSessionId,
        userExternalId: user.id,
      });
    }

    return NextResponse.redirect(
      new URL(
        decodedState?.orgSlug
          ? `/${decodedState.orgSlug}/integrations/slack?slack_error=${encodeURIComponent(error)}`
          : `/login?slack_error=${encodeURIComponent(error)}`,
        request.url,
      ),
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing Slack OAuth code or state" },
      { status: 400 },
    );
  }

  if (!decodedState) {
    return NextResponse.json(
      { error: "Invalid Slack OAuth state" },
      { status: 400 },
    );
  }

  if (decodedState.userExternalId !== user.id) {
    return NextResponse.json(
      { error: "Slack OAuth state does not match the signed-in user" },
      { status: 403 },
    );
  }

  try {
    const installation = await exchangeSlackCodeForBotToken(code);

    const result = await completeSlackOnboardingAndProvision({
      botToken: installation.botToken,
      installerUserId: installation.installerUserId,
      onboardingSessionId: decodedState.onboardingSessionId,
      scopeCsv: installation.scopeCsv,
      slackBotUserId: installation.slackBotUserId,
      slackTeamId: installation.teamId,
      slackTeamName: installation.teamName,
      userExternalId: user.id,
    });

    try {
      const directory = await fetchSlackMessagingDirectory(
        installation.botToken,
      );

      await syncMessagingDirectoryForTenantIntegration({
        conversations: directory.conversations,
        externalWorkspaceId: installation.teamId,
        members: directory.members,
        tenantIntegrationId: result.tenantIntegrationId,
        workspaceDisplayName: installation.teamName,
      });
    } catch (directoryError) {
      await recordMessagingWorkspaceSyncFailure({
        error: getErrorMessage(directoryError),
        externalWorkspaceId: installation.teamId,
        tenantIntegrationId: result.tenantIntegrationId,
        workspaceDisplayName: installation.teamName,
      });
    }

    return NextResponse.redirect(
      new URL(
        `/${result.organizationSlug}/integrations/slack?slack_connected=1`,
        request.url,
      ),
    );
  } catch (oauthError) {
    const message = getErrorMessage(oauthError);

    await recordSlackOauthFailure({
      error: message,
      onboardingSessionId: decodedState.onboardingSessionId,
      userExternalId: user.id,
    });

    return NextResponse.redirect(
      new URL(
        `/${decodedState.orgSlug}/integrations/slack?slack_error=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Slack could not be connected";
}
