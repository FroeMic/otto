import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getTenantManagedIntegrationConnectContext } from "@/db/control-plane";
import { hasLinearOAuthConfig } from "@/lib/env";
import { createManagedIntegrationOauthAuthorizationUrl } from "@/lib/oauth/service";

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
  const { provider } = await context.params;
  const providerKey = provider.trim().toLowerCase();
  const orgSlug = url.searchParams.get("orgSlug");
  const fallbackPath = orgSlug
    ? `/${orgSlug}/integrations/${providerKey}`
    : "/login";

  try {
    if (!orgSlug) {
      throw new Error("Missing workspace slug.");
    }

    if (providerKey === "linear" && !hasLinearOAuthConfig()) {
      throw new Error("Linear is not available right now.");
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
    return NextResponse.redirect(
      new URL(
        `${fallbackPath}?${providerKey}_error=${encodeURIComponent(getErrorMessage(error))}`,
        request.url,
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
