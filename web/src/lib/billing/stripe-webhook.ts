import type Stripe from "stripe";

import {
  buildSubscriptionRecordFromStripe,
  createSubscriptionCreditGrant,
  createTopUpCreditGrant,
  findOrganizationIdByStripeCustomerId,
  hasProcessedStripeWebhookEvent,
  markBillingAutoTopOffRunFailedByInvoiceId,
  markBillingAutoTopOffRunSucceededByInvoiceId,
  markStripeWebhookEventProcessed,
  recordBillingCheckoutSession,
  upsertBillingCustomerRecord,
  upsertBillingSubscriptionRecord,
} from "@/db/billing";
import {
  getAutoTopOffPackByLookupKey,
  getBillingPlanByKey,
} from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { getStripeWebhookSecret } from "@/lib/env";

export async function handleStripeWebhookRequest(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return json(
      {
        error: "Missing Stripe signature header.",
      },
      400,
    );
  }

  const payload = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify Stripe webhook signature.",
      },
      400,
    );
  }

  if (await hasProcessedStripeWebhookEvent(event.id)) {
    return json({ received: true, replay: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case "customer.subscription.deleted":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        break;
    }

    await markStripeWebhookEventProcessed({
      eventType: event.type,
      stripeEventId: event.id,
    });

    return json({ received: true });
  } catch (error) {
    console.error("[stripe] webhook processing failed", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook processing failed.",
      },
      500,
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const organizationId =
    session.client_reference_id ?? session.metadata?.organization_id ?? null;
  const stripeCustomerId = getStripeCustomerId(session.customer);

  if (!organizationId || !stripeCustomerId) {
    return;
  }

  await upsertBillingCustomerRecord({
    organizationId,
    stripeCustomerId,
  });

  await recordBillingCheckoutSession({
    checkoutUrl: session.url ?? null,
    mode: session.mode,
    organizationId,
    planKey:
      session.metadata?.plan_key === "basic_monthly" ||
      session.metadata?.plan_key === "plus_monthly" ||
      session.metadata?.plan_key === "pro_monthly" ||
      session.metadata?.plan_key === "max_monthly"
        ? session.metadata.plan_key
        : null,
    status: session.status ?? "complete",
    stripeCheckoutSessionId: session.id,
    stripeCustomerId,
    stripeSubscriptionId:
      typeof session.subscription === "string" ? session.subscription : null,
  });

  if (typeof session.subscription !== "string") {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription,
  );
  await handleSubscriptionChange(subscription);
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const stripeCustomerId = getStripeCustomerId(subscription.customer);

  if (!stripeCustomerId) {
    return;
  }

  const organizationId =
    (await findOrganizationIdByStripeCustomerId(stripeCustomerId)) ??
    subscription.metadata.organization_id ??
    null;

  if (!organizationId) {
    return;
  }

  const primaryItem = subscription.items.data[0] ?? null;

  await upsertBillingCustomerRecord({
    organizationId,
    stripeCustomerId,
  });

  await upsertBillingSubscriptionRecord(
    buildSubscriptionRecordFromStripe({
      organizationId,
      subscription: {
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: primaryItem?.current_period_end ?? null,
        current_period_start: primaryItem?.current_period_start ?? null,
        customer: stripeCustomerId,
        id: subscription.id,
        items: subscription.items.data.map((item) => ({
          price: item.price
            ? {
                id: item.price.id,
                lookupKey: item.price.lookup_key,
              }
            : null,
        })),
        status: subscription.status,
        trial_end: subscription.trial_end,
      },
    }),
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const metadata = invoice.metadata ?? {};
  const autoTopOffLookupKey = metadata.otto_top_up_lookup_key ?? null;
  const chargeKind = metadata.otto_charge_kind ?? null;

  if (chargeKind === "auto_top_off" && autoTopOffLookupKey) {
    await handleAutoTopOffInvoicePaid(invoice, autoTopOffLookupKey);
    return;
  }

  const stripeCustomerId = getStripeCustomerId(invoice.customer);

  if (!stripeCustomerId) {
    return;
  }

  const stripeSubscriptionId = getStripeInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const primaryItem = subscription.items.data[0] ?? null;
  const organizationId =
    (await findOrganizationIdByStripeCustomerId(stripeCustomerId)) ??
    subscription.metadata.organization_id ??
    null;

  if (!organizationId) {
    return;
  }

  await handleSubscriptionChange(subscription);

  const stripePriceId = subscription.items.data[0]?.price?.id ?? null;

  if (!stripePriceId) {
    return;
  }

  const subscriptionRecord = buildSubscriptionRecordFromStripe({
    organizationId,
    subscription: {
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: primaryItem?.current_period_end ?? null,
      current_period_start: primaryItem?.current_period_start ?? null,
      customer: stripeCustomerId,
      id: subscription.id,
      items: subscription.items.data.map((item) => ({
        price: item.price
          ? {
              id: item.price.id,
              lookupKey: item.price.lookup_key,
            }
          : null,
      })),
      status: subscription.status,
      trial_end: subscription.trial_end,
    },
  });

  if (!subscriptionRecord.planKey) {
    return;
  }

  const plan = getBillingPlanByKey(subscriptionRecord.planKey);

  if (!plan) {
    return;
  }

  await createSubscriptionCreditGrant({
    creditsGrantedMilli: plan.creditsIncluded * 1_000,
    expiresAt: subscriptionRecord.currentPeriodEnd,
    organizationId,
    planKey: subscriptionRecord.planKey,
    stripeInvoiceId: invoice.id,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const metadata = invoice.metadata ?? {};

  if (
    metadata.otto_charge_kind === "auto_top_off" &&
    metadata.otto_top_up_lookup_key
  ) {
    await markBillingAutoTopOffRunFailedByInvoiceId({
      reason:
        invoice.last_finalization_error?.message ??
        "Stripe could not collect the auto-top-off invoice.",
      stripeInvoiceId: invoice.id,
    });
    return;
  }

  const stripeSubscriptionId = getStripeInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);
  await handleSubscriptionChange(subscription);
}

async function handleAutoTopOffInvoicePaid(
  invoice: Stripe.Invoice,
  lookupKey: string,
) {
  const pack = getAutoTopOffPackByLookupKey(lookupKey);

  if (!pack) {
    return;
  }

  const stripeCustomerId = getStripeCustomerId(invoice.customer);

  if (!stripeCustomerId) {
    return;
  }

  const organizationId =
    invoice.metadata?.organization_id ??
    (await findOrganizationIdByStripeCustomerId(stripeCustomerId)) ??
    null;

  if (!organizationId) {
    return;
  }

  await createTopUpCreditGrant({
    creditsGrantedMilli: pack.creditsGranted * 1_000,
    lookupKey,
    organizationId,
    stripeInvoiceId: invoice.id,
  });
  await markBillingAutoTopOffRunSucceededByInvoiceId({
    stripeInvoiceId: invoice.id,
  });
}

function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function getStripeInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription =
    invoice.parent?.subscription_details?.subscription ?? null;

  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
