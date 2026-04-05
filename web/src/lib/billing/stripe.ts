import Stripe from "stripe";

import { type BillingPlanKey, getBillingPlanByKey } from "@/lib/billing/plans";
import { getStripeSecretKey } from "@/lib/env";

let cachedStripe: Stripe | null = null;

export type StripeInvoiceSummary = {
  amountDueCents: number;
  amountPaidCents: number;
  createdAt: Date;
  currency: string;
  hostedInvoiceUrl: string | null;
  id: string;
  invoicePdfUrl: string | null;
  number: string | null;
  status: string | null;
};

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

  const describedPrices = prices.data.map((price) => {
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

    return {
      active: price.active,
      currency: price.currency,
      id: price.id,
      livemode: price.livemode,
      lookupKey: price.lookup_key,
      productId,
      productName,
      recurringInterval: price.recurring?.interval ?? null,
      recurringIntervalCount: price.recurring?.interval_count ?? null,
      type: price.type,
      unitAmount: price.unit_amount,
    };
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
      expectedCurrency: "usd",
      expectedInterval: "month",
      expectedType: "recurring",
      lookupKey: plan.key,
      matchingCount: recurringMonthlyPrices.length,
      returnedPrices: describedPrices,
    });

    const returnedPriceSummary =
      describedPrices.length > 0
        ? describedPrices
            .map((price) => {
              return `${price.id} (currency=${price.currency}, type=${price.type}, interval=${price.recurringInterval ?? "none"}, active=${price.active}, product=${price.productName ?? price.productId ?? "unknown"})`;
            })
            .join("; ")
        : "none";

    throw new Error(
      `Expected exactly one active monthly Stripe price for lookup key ${plan.key} in usd. Returned prices: ${returnedPriceSummary}. Make sure Stripe has exactly one active recurring monthly USD price with this lookup key.`,
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

export async function listStripeInvoicesForCustomer(input: {
  limit?: number;
  stripeCustomerId: string;
}): Promise<StripeInvoiceSummary[]> {
  const stripe = getStripe();
  const invoices = await stripe.invoices.list({
    customer: input.stripeCustomerId,
    limit: input.limit ?? 12,
  });

  return invoices.data.map((invoice) => ({
    amountDueCents: invoice.amount_due,
    amountPaidCents: invoice.amount_paid,
    createdAt: new Date(invoice.created * 1000),
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    id: invoice.id,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    number: invoice.number,
    status: invoice.status,
  }));
}
