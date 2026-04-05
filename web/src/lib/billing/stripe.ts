import Stripe from "stripe";

import {
  type BillingPlanKey,
  getAutoTopOffPackByLookupKey,
  getBillingPlanByKey,
} from "@/lib/billing/plans";
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

  return getStripePriceIdForLookupKey({
    description: plan.name,
    expectedCurrency: "usd",
    expectedInterval: "month",
    expectedType: "recurring",
    lookupKey: plan.key,
    logPrefix: "billing/stripe",
  });
}

export async function getStripeOneTimePriceIdForTopUpLookupKey(
  lookupKey: string,
) {
  const pack = getAutoTopOffPackByLookupKey(lookupKey);

  if (!pack) {
    throw new Error(`Unknown top-up lookup key: ${lookupKey}`);
  }

  return getStripePriceIdForLookupKey({
    description: pack.label,
    expectedCurrency: "usd",
    expectedInterval: null,
    expectedType: "one_time",
    lookupKey,
    logPrefix: "billing/stripe",
  });
}

async function getStripePriceIdForLookupKey(input: {
  description: string;
  expectedCurrency: string;
  expectedInterval: "month" | null;
  expectedType: "one_time" | "recurring";
  lookupKey: string;
  logPrefix: string;
}) {

  const stripe = getStripe();
  console.info(`[${input.logPrefix}] resolving price`, {
    description: input.description,
    expectedCurrency: input.expectedCurrency,
    expectedInterval: input.expectedInterval,
    expectedType: input.expectedType,
    lookupKey: input.lookupKey,
  });

  const prices = await stripe.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 10,
    lookup_keys: [input.lookupKey],
  });

  console.info(`[${input.logPrefix}] lookup returned prices`, {
    hasMore: prices.has_more,
    lookupKey: input.lookupKey,
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

  const matchingPrices = prices.data.filter((price) => {
    const matchesLookupKey = price.lookup_key === input.lookupKey;
    const matchesCurrency = price.currency === input.expectedCurrency;
    const matchesInterval =
      input.expectedInterval === null
        ? price.recurring === null
        : price.recurring?.interval === input.expectedInterval;
    const matchesType = price.type === input.expectedType;
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

    console.info(`[${input.logPrefix}] price candidate`, {
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

  console.info(`[${input.logPrefix}] filtered prices`, {
    lookupKey: input.lookupKey,
    matchingCount: matchingPrices.length,
    matchingPriceIds: matchingPrices.map((price) => price.id),
  });

  if (matchingPrices.length !== 1) {
    console.error(`[${input.logPrefix}] price resolution failed`, {
      expectedCurrency: input.expectedCurrency,
      expectedInterval: input.expectedInterval,
      expectedType: input.expectedType,
      lookupKey: input.lookupKey,
      matchingCount: matchingPrices.length,
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
      `Expected exactly one active ${input.expectedType === "recurring" ? "monthly recurring" : "one-time"} Stripe price for lookup key ${input.lookupKey} in ${input.expectedCurrency}. Returned prices: ${returnedPriceSummary}. Make sure Stripe has exactly one active ${input.expectedType === "recurring" ? "recurring monthly" : "one-time"} ${input.expectedCurrency.toUpperCase()} price with this lookup key.`,
    );
  }

  const [price] = matchingPrices;

  if (!price) {
    throw new Error(
      `Expected exactly one active Stripe price for lookup key ${input.lookupKey}.`,
    );
  }

  console.info(`[${input.logPrefix}] resolved price`, {
    lookupKey: input.lookupKey,
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
