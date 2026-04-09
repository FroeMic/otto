import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  findBillingCustomerByOrganizationId,
  getWorkspaceBillingOverview,
} from "../../../../../../db/billing";
import {
  getOrganizationWorkspaceBySlug,
  syncUserFromSession,
} from "../../../../../../db/control-plane";
import { getStripe } from "../../../../../../lib/billing/stripe";
import { getControlPlaneBaseUrl } from "../../../../../../lib/env";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    await syncUserFromSession(user);

    const organization = await getOrganizationWorkspaceBySlug({
      orgSlug,
      userExternalId: user.id,
    });
    const customer = await findBillingCustomerByOrganizationId(organization.id);

    if (!customer) {
      const overview = await getWorkspaceBillingOverview({
        organizationId: organization.id,
      });

      if (!overview.subscription) {
        return json(
          {
            code: "billing_customer_missing",
            message:
              "This workspace does not have an active billing customer yet.",
          },
          400,
        );
      }

      throw new Error("Billing customer state is missing for this workspace.");
    }

    const stripe = getStripe();
    const baseUrl = getControlPlaneBaseUrl();

    if (!baseUrl) {
      throw new Error("The public app base URL is not configured.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${baseUrl}/${organization.slug}/settings/workspace/billing`,
    });

    return json({
      url: session.url,
    });
  } catch (error) {
    return json(
      {
        code: "billing_portal_failed",
        message:
          error instanceof Error ? error.message : "Billing portal failed.",
      },
      400,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
