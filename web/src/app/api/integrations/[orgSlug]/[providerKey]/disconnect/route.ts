import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { disconnectTenantManagedIntegration } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
      providerKey: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug, providerKey } = await context.params;
    const result = await disconnectTenantManagedIntegration({
      orgSlug,
      providerKey,
      userExternalId: user.id,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "managed_integration_disconnect_failed",
        message:
          error instanceof Error
            ? error.message
            : "Integration disconnect failed",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status: 400,
      },
    );
  }
}
