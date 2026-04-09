import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import {
  completeLinearOauthConnection,
  completeSlackOauthConnection,
  completeSlackOnboardingAndProvision,
  recordLinearOauthFailure,
  recordMessagingWorkspaceSyncFailure,
  recordSlackManagedOauthFailure,
  recordSlackOauthFailure,
  syncMessagingDirectoryForTenantIntegration,
} from "../../../../../db/control-plane";
import { getLocalUserIdForExternalId } from "../../../../../db/oauth";
import { getIntegrationDefinition } from "../../../../../integrations/framework";
import {
  isSlackOnboardingOAuthState,
  type SlackOnboardingOAuthState,
  verifySlackOnboardingOAuthState,
} from "../../../../../integrations/library/slack/oauth/onboarding-state";
import { getControlPlaneBaseUrl } from "../../../../../lib/env";
import { getManagedIntegrationOauthCallbackContext } from "../../../../../lib/oauth/service";
import { fetchSlackMessagingDirectory } from "../../../../../lib/slack";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      provider: string;
    }>;
  },
) {
  const redirectBaseUrl = getControlPlaneBaseUrl() || request.url;
  const { user } = await withAuth({ ensureSignedIn: true });
  const url = new URL(request.url);
  const { provider } = await context.params;
  const providerKey = provider.trim().toLowerCase();
  const code = url.searchParams.get("code");
  const encodedState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const localUserId = await getLocalUserIdForExternalId(user.id);
  let onboardingState: SlackOnboardingOAuthState | null = null;
  let callbackContext: Awaited<
    ReturnType<typeof getManagedIntegrationOauthCallbackContext>
  > | null = null;

  try {
    if (!localUserId) {
      throw new Error("Signed-in user could not be matched locally.");
    }

    if (providerKey === "slack" && encodedState) {
      try {
        const candidateState = verifySlackOnboardingOAuthState(encodedState);

        if (isSlackOnboardingOAuthState(candidateState)) {
          onboardingState = candidateState;
        }
      } catch {
        onboardingState = null;
      }
    }

    if (encodedState && !onboardingState) {
      callbackContext = await getManagedIntegrationOauthCallbackContext({
        encodedState,
        expectedProviderKey: providerKey,
        userId: localUserId,
      });
    }

    if (providerError) {
      throw new Error(providerError);
    }

    if (!code || !encodedState) {
      return NextResponse.json(
        {
          error: "Missing OAuth code or state.",
        },
        { status: 400 },
      );
    }

    if (providerKey === "slack" && onboardingState) {
      if (onboardingState.userExternalId !== user.id) {
        return NextResponse.json(
          { error: "Slack OAuth state does not match the signed-in user" },
          { status: 403 },
        );
      }

      return await handleSlackOnboardingCallback({
        code,
        onboardingState,
        redirectBaseUrl,
        userExternalId: user.id,
      });
    }

    if (!callbackContext) {
      throw new Error("OAuth callback state could not be verified.");
    }

    if (callbackContext.session.consumedAt) {
      return NextResponse.redirect(
        buildSuccessRedirect(
          callbackContext.session.organizationSlug,
          callbackContext.session.providerKey,
          redirectBaseUrl,
        ),
      );
    }

    const tokenResult = await callbackContext.provider.exchangeCode({
      code,
      codeVerifier: callbackContext.session.pkceCodeVerifier,
    });

    switch (callbackContext.session.providerKey) {
      case "linear":
        await completeLinearOauthConnection({
          actorType: tokenResult.actorType,
          externalAccountId: tokenResult.identity?.externalAccountId ?? null,
          externalAccountLabel:
            tokenResult.identity?.externalAccountLabel ?? null,
          mode:
            callbackContext.session.mode === "reconnect"
              ? "reconnect"
              : "connect",
          organizationId: callbackContext.session.organizationId,
          requestedScopes: callbackContext.session.requestedScopes,
          sessionId: callbackContext.session.id,
          tokenResult,
        });
        break;
      case "slack":
        await completeSlackOauthConnection({
          mode:
            callbackContext.session.mode === "reconnect"
              ? "reconnect"
              : "connect",
          organizationId: callbackContext.session.organizationId,
          requestedScopes: callbackContext.session.requestedScopes,
          sessionId: callbackContext.session.id,
          tokenResult,
        });
        break;
      default:
        throw new Error(
          `Unsupported managed integration callback: ${callbackContext.session.providerKey}`,
        );
    }

    return NextResponse.redirect(
      buildSuccessRedirect(
        callbackContext.session.organizationSlug,
        callbackContext.session.providerKey,
        redirectBaseUrl,
      ),
    );
  } catch (error) {
    if (providerKey === "slack" && onboardingState) {
      if (providerError || error instanceof Error) {
        await recordSlackOauthFailure({
          error: getErrorMessage(error),
          onboardingSessionId: onboardingState.onboardingSessionId,
          userExternalId: user.id,
        });
      }

      return NextResponse.redirect(
        new URL(
          `/${onboardingState.orgSlug}/onboarding?slack_error=${encodeURIComponent(getErrorMessage(error))}`,
          redirectBaseUrl,
        ),
      );
    }

    if (callbackContext?.session.providerKey === "linear") {
      await recordLinearOauthFailure({
        error: getErrorMessage(error),
        organizationId: callbackContext.session.organizationId,
      });
    } else if (callbackContext?.session.providerKey === "slack") {
      await recordSlackManagedOauthFailure({
        error: getErrorMessage(error),
        organizationId: callbackContext.session.organizationId,
      });
    }

    return NextResponse.redirect(
      buildFailureRedirect(
        callbackContext?.session.organizationSlug ?? null,
        providerKey,
        getErrorMessage(error),
        redirectBaseUrl,
      ),
    );
  }
}

async function handleSlackOnboardingCallback(input: {
  code: string;
  onboardingState: SlackOnboardingOAuthState;
  redirectBaseUrl: string;
  userExternalId: string;
}) {
  const { exchangeSlackCodeForBotToken } = await import("../../../../../lib/slack");
  const installation = await exchangeSlackCodeForBotToken(input.code);

  const result = await completeSlackOnboardingAndProvision({
    botToken: installation.botToken,
    installerUserId: installation.installerUserId,
    onboardingSessionId: input.onboardingState.onboardingSessionId,
    scopeCsv: installation.scopeCsv,
    slackBotUserId: installation.slackBotUserId,
    slackTeamId: installation.teamId,
    slackTeamName: installation.teamName,
    userExternalId: input.userExternalId,
  });

  try {
    const directory = await fetchSlackMessagingDirectory(installation.botToken);

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
      `/${result.organizationSlug}/onboarding?slack_connected=1`,
      input.redirectBaseUrl,
    ),
  );
}

function buildSuccessRedirect(
  orgSlug: string,
  providerKey: string,
  requestUrl: string,
) {
  const definition = getIntegrationDefinition(providerKey);
  const path = definition
    ? definition.settingsPath(orgSlug)
    : `/${orgSlug}/integrations2/${providerKey}/status`;

  return new URL(`${path}?${providerKey}_connected=1`, requestUrl);
}

function buildFailureRedirect(
  orgSlug: string | null,
  providerKey: string,
  message: string,
  requestUrl: string,
) {
  const definition = orgSlug ? getIntegrationDefinition(providerKey) : null;
  const path =
    orgSlug && definition
      ? definition.settingsPath(orgSlug)
      : orgSlug
        ? `/${orgSlug}/integrations2/${providerKey}/status`
        : null;

  return new URL(
    path
      ? `${path}?${providerKey}_error=${encodeURIComponent(message)}`
      : `/login?${providerKey}_error=${encodeURIComponent(message)}`,
    requestUrl,
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The integration could not be connected.";
}
