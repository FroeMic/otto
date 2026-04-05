import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  findBillingCustomerByOrganizationId,
  recordBillingCheckoutSession,
  upsertBillingCustomerRecord,
} from "@/db/billing";
import {
  getOrganizationWorkspaceBySlug,
  syncUserFromSession,
} from "@/db/control-plane";
import { getBillingPlanByKey } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { getControlPlaneBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  planKey: z.enum([
    "basic_monthly",
    "plus_monthly",
    "pro_monthly",
    "max_monthly",
  ]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    await syncUserFromSession(user);

    const body = bodySchema.parse(await request.json());
    const organization = await getOrganizationWorkspaceBySlug({
      orgSlug,
      userExternalId: user.id,
    });
    const plan = getBillingPlanByKey(body.planKey);

    if (!plan) {
      return json(
        {
          code: "billing_plan_not_found",
          message: "Unknown billing plan.",
        },
        400,
      );
    }

    const stripe = getStripe();
    const baseUrl = getControlPlaneBaseUrl();

    if (!baseUrl) {
      throw new Error("The public app base URL is not configured.");
    }

    let customer = await findBillingCustomerByOrganizationId(organization.id);

    if (!customer) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          organization_external_id: organization.externalId,
          organization_id: organization.id,
          organization_slug: organization.slug,
        },
        name: organization.name,
      });

      customer = await upsertBillingCustomerRecord({
        defaultCurrency: stripeCustomer.currency,
        organizationId: organization.id,
        stripeCustomerId: stripeCustomer.id,
      });
    }

    if (!customer) {
      throw new Error("Failed to create or load the Stripe customer.");
    }

    const session = await stripe.checkout.sessions.create({
      cancel_url: `${baseUrl}/${organization.slug}/settings/workspace/billing?checkout=canceled`,
      client_reference_id: organization.id,
      customer: customer.stripeCustomerId,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        organization_id: organization.id,
        organization_slug: organization.slug,
        plan_key: plan.key,
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          organization_id: organization.id,
          organization_slug: organization.slug,
          plan_key: plan.key,
        },
      },
      success_url: `${baseUrl}/${organization.slug}/settings/workspace/billing?checkout=success`,
    });

    await recordBillingCheckoutSession({
      checkoutUrl: session.url ?? null,
      mode: session.mode,
      organizationId: organization.id,
      planKey: plan.key,
      status: session.status ?? "open",
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: customer.stripeCustomerId,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : null,
    });

    return json({
      url: session.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          code: "billing_checkout_invalid_payload",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid billing checkout payload.",
        },
        400,
      );
    }

    return json(
      {
        code: "billing_checkout_failed",
        message:
          error instanceof Error ? error.message : "Billing checkout failed.",
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
