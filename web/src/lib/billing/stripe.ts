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
  console.info("[billing/stripe] resolving recurring price", {
    lookupKey: plan.key,
    planName: plan.name,
  });

  const prices = await stripe.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 10,
    lookup_keys: [plan.key],
  });

  console.info("[billing/stripe] lookup returned prices", {
    hasMore: prices.has_more,
    lookupKey: plan.key,
    returnedCount: prices.data.length,
  });

  const recurringMonthlyPrices = prices.data.filter((price) => {
    const matchesLookupKey = price.lookup_key === plan.key;
    const matchesCurrency = price.currency === "usd";
    const matchesInterval = price.recurring?.interval === "month";
    const matchesType = price.type === "recurring";
    const expandedProduct =
      typeof price.product === "string" ? null : (price.product ?? null);
    const productName =
      expandedProduct && "name" in expandedProduct
        ? expandedProduct.name
        : null;
    const productId =
      typeof price.product === "string"
        ? price.product
        : (expandedProduct?.id ?? null);

    console.info("[billing/stripe] price candidate", {
      active: price.active,
      currency: price.currency,
      id: price.id,
      livemode: price.livemode,
      lookupKey: price.lookup_key,
      matchesCurrency,
      matchesInterval,
      matchesLookupKey,
      matchesType,
      productId,
      productName,
      recurringInterval: price.recurring?.interval ?? null,
      recurringIntervalCount: price.recurring?.interval_count ?? null,
      type: price.type,
      unitAmount: price.unit_amount,
      unitAmountDecimal: price.unit_amount_decimal,
    });

    return (
      matchesLookupKey && matchesCurrency && matchesInterval && matchesType
    );
  });

  console.info("[billing/stripe] filtered recurring monthly prices", {
    lookupKey: plan.key,
    matchingCount: recurringMonthlyPrices.length,
    matchingPriceIds: recurringMonthlyPrices.map((price) => price.id),
  });

  if (recurringMonthlyPrices.length !== 1) {
    console.error("[billing/stripe] recurring price resolution failed", {
      lookupKey: plan.key,
      matchingCount: recurringMonthlyPrices.length,
      returnedPriceIds: prices.data.map((price) => price.id),
    });
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

  console.info("[billing/stripe] resolved recurring price", {
    lookupKey: plan.key,
    priceId: price.id,
  });

  return price.id;
}
