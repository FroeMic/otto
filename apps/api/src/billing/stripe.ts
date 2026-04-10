import Stripe from "stripe"

import {
  type BillingPlanKey,
  getAutoTopOffPackByLookupKey,
  getBillingPlanByKey,
} from "./plans"

let cachedStripe: Stripe | null = null

function getExpandableId<T extends { id: string }>(
  value: string | T | null | undefined,
) {
  if (!value) {
    return null
  }

  return typeof value === "string" ? value : value.id
}

export function getStripe() {
  if (cachedStripe) {
    return cachedStripe
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required")
  }

  cachedStripe = new Stripe(secretKey, {
    maxNetworkRetries: 2,
  })

  return cachedStripe
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required")
  }

  return secret
}

export async function syncStripeAutoTopOffPaymentMethodDefaults(input: {
  stripeCustomerId: string
  stripeSubscriptionId: string
}) {
  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(input.stripeCustomerId)

  if (customer.deleted) {
    return {
      synced: false,
    }
  }

  const customerDefaultPaymentMethodId = getExpandableId(
    customer.invoice_settings.default_payment_method,
  )
  const savedPaymentMethods = await stripe.customers.listPaymentMethods(
    input.stripeCustomerId,
    {
      limit: 1,
      type: "card",
    },
  )
  const fallbackCustomerPaymentMethodId =
    savedPaymentMethods.data[0]?.id ?? null
  const subscription = await stripe.subscriptions.retrieve(
    input.stripeSubscriptionId,
    {
      expand: ["default_payment_method"],
    },
  )
  const subscriptionDefaultPaymentMethodId = getExpandableId(
    subscription.default_payment_method,
  )
  const paymentMethodId =
    customerDefaultPaymentMethodId ??
    subscriptionDefaultPaymentMethodId ??
    fallbackCustomerPaymentMethodId

  if (!paymentMethodId) {
    return {
      synced: false,
    }
  }

  if (customerDefaultPaymentMethodId !== paymentMethodId) {
    await stripe.customers.update(input.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })
  }

  if (subscriptionDefaultPaymentMethodId !== paymentMethodId) {
    await stripe.subscriptions.update(input.stripeSubscriptionId, {
      default_payment_method: paymentMethodId,
    })
  }

  return {
    synced: true,
  }
}

export async function getStripeInvoiceFailureReason(input: {
  defaultMessage: string
  stripeInvoiceId: string
}) {
  const stripe = getStripe()
  const invoice = (await stripe.invoices.retrieve(input.stripeInvoiceId, {
    expand: ["payment_intent"],
  })) as unknown as {
    last_finalization_error?: {
      message?: string | null
    } | null
    payment_intent?:
      | string
      | {
          last_payment_error?: {
            message?: string | null
          } | null
        }
      | null
  }

  if (invoice.last_finalization_error?.message) {
    return invoice.last_finalization_error.message
  }

  const paymentIntent =
    typeof invoice.payment_intent === "string"
      ? null
      : (invoice.payment_intent ?? null)

  if (paymentIntent?.last_payment_error?.message) {
    return paymentIntent.last_payment_error.message
  }

  return input.defaultMessage
}

export async function getStripeRecurringPriceIdForPlanKey(
  planKey: BillingPlanKey,
) {
  const plan = getBillingPlanByKey(planKey)

  if (!plan) {
    throw new Error(`Unknown billing plan key: ${planKey}`)
  }

  return getStripePriceIdForLookupKey({
    expectedCurrency: "usd",
    expectedInterval: "month",
    expectedType: "recurring",
    lookupKey: plan.key,
  })
}

export async function getStripeOneTimePriceIdForTopUpLookupKey(
  lookupKey: string,
) {
  const pack = getAutoTopOffPackByLookupKey(lookupKey)

  if (!pack) {
    throw new Error(`Unknown top-up lookup key: ${lookupKey}`)
  }

  return getStripePriceIdForLookupKey({
    expectedCurrency: "usd",
    expectedInterval: null,
    expectedType: "one_time",
    lookupKey,
  })
}

async function getStripePriceIdForLookupKey(input: {
  expectedCurrency: string
  expectedInterval: "month" | null
  expectedType: "one_time" | "recurring"
  lookupKey: string
}) {
  const stripe = getStripe()
  const prices = await stripe.prices.list({
    active: true,
    limit: 10,
    lookup_keys: [input.lookupKey],
  })
  const matchingPrices = prices.data.filter((price) => {
    const matchesLookupKey = price.lookup_key === input.lookupKey
    const matchesCurrency = price.currency === input.expectedCurrency
    const matchesInterval =
      input.expectedInterval === null
        ? price.recurring === null
        : price.recurring?.interval === input.expectedInterval
    const matchesType = price.type === input.expectedType

    return matchesLookupKey && matchesCurrency && matchesInterval && matchesType
  })

  if (matchingPrices.length !== 1) {
    throw new Error(
      `Expected exactly one active Stripe price for lookup key ${input.lookupKey}.`,
    )
  }

  const [price] = matchingPrices
  if (!price) {
    throw new Error(
      `Expected exactly one active Stripe price for lookup key ${input.lookupKey}.`,
    )
  }

  return price.id
}
