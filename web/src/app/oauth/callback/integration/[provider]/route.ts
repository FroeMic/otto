import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import {
  completeLinearOauthConnection,
  recordLinearOauthFailure,
} from "@/db/control-plane";
import { getLocalUserIdForExternalId } from "@/db/oauth";
import { getControlPlaneBaseUrl } from "@/lib/env";
import { getManagedIntegrationOauthCallbackContext } from "@/lib/oauth/service";

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
  let callbackContext: Awaited<
    ReturnType<typeof getManagedIntegrationOauthCallbackContext>
  > | null = null;

  try {
    if (!localUserId) {
      throw new Error("Signed-in user could not be matched locally.");
    }

    if (encodedState) {
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
    if (callbackContext?.session.providerKey === "linear") {
      await recordLinearOauthFailure({
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

function buildSuccessRedirect(
  orgSlug: string,
  providerKey: string,
  requestUrl: string,
) {
  return new URL(
    `/${orgSlug}/integrations/${providerKey}?${providerKey}_connected=1`,
    requestUrl,
  );
}

function buildFailureRedirect(
  orgSlug: string | null,
  providerKey: string,
  message: string,
  requestUrl: string,
) {
  return new URL(
    orgSlug
      ? `/${orgSlug}/integrations/${providerKey}?${providerKey}_error=${encodeURIComponent(message)}`
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
