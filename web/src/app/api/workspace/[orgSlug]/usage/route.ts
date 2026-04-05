import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getOrganizationTenantForBilling } from "@/db/billing";
import {
  getOrganizationWorkspaceBySlug,
  syncUserFromSession,
} from "@/db/control-plane";
import { getTenantProviderUsageOverview } from "@/db/provider-usage";

export const dynamic = "force-dynamic";

function getEmptyUsageOverview() {
  return {
    summary: {
      activeApiKeys: 0,
      activeModels: 0,
      totalCreditsBurnedMilli: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalProviderCostMicros: 0,
      totalRequests: 0,
    },
    timeSeries: [],
    usageByModel: [],
    usageByType: [],
  };
}

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

    if (from > to) {
      return json(
        {
          code: "bad_request",
          message: "The start date must be before the end date.",
        },
        400,
      );
    }

    const organization = await getOrganizationWorkspaceBySlug({
      orgSlug,
      userExternalId: user.id,
    });
    const tenant = await getOrganizationTenantForBilling(organization.id);

    if (!tenant) {
      return json(getEmptyUsageOverview());
    }

    const overview = await getTenantProviderUsageOverview({
      from,
      tenantId: tenant.id,
      to,
    });

    return json(overview);
  } catch (error) {
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
