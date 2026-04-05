import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  getPlatformTenantTarget,
  syncUserFromSession,
} from "@/db/control-plane";
import { getTenantProviderUsageOverview } from "@/db/provider-usage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    await syncUserFromSession(user);

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    if (!fromParam || !toParam) {
      return json(
        { code: "bad_request", message: "Missing from/to params" },
        400,
      );
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return json(
        { code: "bad_request", message: "Invalid from/to dates" },
        400,
      );
    }

    const tenant = await getPlatformTenantTarget({
      orgSlug,
      userExternalId: user.id,
    });

    if (!tenant) {
      return json({ code: "not_found", message: "Tenant not found" }, 404);
    }

    const overview = await getTenantProviderUsageOverview({
      from,
      tenantId: tenant.tenantId,
      to,
    });

    return json(overview);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Platform admin access required"
    ) {
      return json({ code: "forbidden", message: error.message }, 403);
    }

    return json(
      {
        code: "usage_fetch_failed",
        message: error instanceof Error ? error.message : "Usage fetch failed.",
      },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
