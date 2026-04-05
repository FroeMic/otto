import Stripe from "stripe";

import { type BillingPlanKey, getBillingPlanByKey } from "@/lib/billing/plans";
import { getStripeSecretKey } from "@/lib/env";

let cachedStripe: Stripe | null = null;

export function getStripe() {
  if (cachedStripe) {
    return cachedStripe;
  }

  cachedStripe = new Stripe(getStripeSecretKey(), {
    maxNetworkRetries: 2,
  });

  return cachedStripe;
}

export async function getStripeRecurringPriceIdForPlanKey(
  planKey: BillingPlanKey,
) {
  const plan = getBillingPlanByKey(planKey);

  if (!plan) {
    throw new Error(`Unknown billing plan key: ${planKey}`);
  }

  const stripe = getStripe();
  const prices = await stripe.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 10,
    lookup_keys: [plan.key],
  });

  const recurringMonthlyPrices = prices.data.filter((price) => {
    return (
      price.lookup_key === plan.key &&
      price.currency === "usd" &&
      price.recurring?.interval === "month" &&
      price.type === "recurring"
    );
  });

  if (recurringMonthlyPrices.length !== 1) {
    throw new Error(
      `Expected exactly one active monthly Stripe price for lookup key ${plan.key}.`,
    );
  }

  const [price] = recurringMonthlyPrices;

  if (!price) {
    throw new Error(
      `Expected exactly one active monthly Stripe price for lookup key ${plan.key}.`,
    );
  }

  return price.id;
}
