import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getTenantManagedIntegrationConnectContext } from "@/db/control-plane";
import { getNangoConfig, hasNangoConfig } from "@/lib/env";
import { createNangoConnectSession } from "@/lib/nango";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;

    if (!hasNangoConfig()) {
      return errorResponse(
        "linear_connect_unavailable",
        "Linear is not available right now.",
        500,
      );
    }

    const connectContext = await getTenantManagedIntegrationConnectContext({
      orgSlug,
      providerKey: "linear",
      userExternalId: user.id,
    });

    if (!connectContext) {
      return errorResponse(
        "linear_workspace_not_found",
        "This workspace is not available.",
        404,
      );
    }

    const session = await createNangoConnectSession({
      connectionId: connectContext.existingConnectionId ?? undefined,
      integrationId: getNangoConfig().linearIntegrationId,
      organizationDisplayName: connectContext.organizationName,
      organizationId: connectContext.organizationId,
      userEmail: connectContext.userEmail,
      userExternalId: user.id,
    });

    return json({
      sessionToken: session.token,
    });
  } catch (error) {
    return errorResponse(
      "linear_connect_session_failed",
      error instanceof Error
        ? error.message
        : "Linear could not be opened right now.",
      400,
    );
  }
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      code,
      message,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status,
    },
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
