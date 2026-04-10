import Stripe from "stripe"

import {
  type BillingPlanKey,
  getAutoTopOffPackByLookupKey,
  getBillingPlanByKey,
} from "./plans"

let cachedStripe: Stripe | null = null

export type StripeInvoiceSummary = {
  amountDueCents: number
  amountPaidCents: number
  createdAt: Date
  currency: string
  hostedInvoiceUrl: string | null
  id: string
  invoicePdfUrl: string | null
  number: string | null
  status: string | null
}

export type StripeInvoicePreviewSummary = {
  amountDueCents: number
  currency: string
  id: string
}

export type StripeAutoTopOffPaymentMethodStatus = {
  customerDefaultPaymentMethodId: string | null
  effectivePaymentMethodId: string | null
  fallbackCustomerPaymentMethodId: string | null
  hasReusablePaymentMethod: boolean
  subscriptionDefaultPaymentMethodId: string | null
}

export const AUTO_TOP_OFF_PAYMENT_METHOD_MESSAGE =
  "Auto-reload needs a default payment method in Stripe. Open Manage billing and set a default card before Otto can charge top-ups automatically."

type PreviewTaxIdType =
  Stripe.InvoiceCreatePreviewParams.CustomerDetails.TaxId["type"]

function toStripeAddressParam(
  address: Stripe.Address | null | undefined,
): Stripe.AddressParam | undefined {
  if (!address) {
    return undefined
  }

  return {
    city: address.city ?? undefined,
    country: address.country ?? undefined,
    line1: address.line1 ?? undefined,
    line2: address.line2 ?? undefined,
    postal_code: address.postal_code ?? undefined,
    state: address.state ?? undefined,
  }
}

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

export function hasStripeBillingConfig() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
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

export async function getStripeBillingCycleSpendCents(input: {
  periodEnd?: Date | null
  periodStart: Date
  stripeCustomerId: string
}) {
  const stripe = getStripe()
  let startingAfter: string | undefined
  let totalPaidCents = 0

  while (true) {
    const invoices = await stripe.invoices.list({
      customer: input.stripeCustomerId,
      limit: 100,
      starting_after: startingAfter,
    })

    for (const invoice of invoices.data) {
      const paidAtUnix = invoice.status_transitions.paid_at

      if (!paidAtUnix || invoice.status !== "paid") {
        continue
      }

      const paidAt = new Date(paidAtUnix * 1000)

      if (paidAt < input.periodStart) {
        return totalPaidCents
      }

      if (input.periodEnd && paidAt >= input.periodEnd) {
        continue
      }

      totalPaidCents += invoice.amount_paid
    }

    if (!invoices.has_more) {
      return totalPaidCents
    }

    const lastInvoice = invoices.data.at(-1)

    if (!lastInvoice) {
      return totalPaidCents
    }

    startingAfter = lastInvoice.id
  }
}

export async function previewStripeTopUpInvoiceCharge(input: {
  stripeCustomerId: string
  topUpLookupKey: string
}): Promise<StripeInvoicePreviewSummary> {
  const stripe = getStripe()
  const priceId = await getStripeOneTimePriceIdForTopUpLookupKey(
    input.topUpLookupKey,
  )
  const customer = await stripe.customers.retrieve(input.stripeCustomerId)

  if (customer.deleted) {
    throw new Error(
      `Stripe customer ${input.stripeCustomerId} was deleted and cannot be used for auto-top-off previews.`,
    )
  }

  const taxIds = await stripe.customers.listTaxIds(input.stripeCustomerId, {
    limit: 20,
  })
  const shippingAddress = toStripeAddressParam(customer.shipping?.address)
  const shippingName = customer.shipping?.name ?? null
  const previewTaxIds = taxIds.data
    .filter(
      (
        taxId,
      ): taxId is typeof taxId & {
        type: PreviewTaxIdType
      } => taxId.type !== "unknown",
    )
    .map((taxId) => ({
      type: taxId.type,
      value: taxId.value,
    }))

  const preview = await stripe.invoices.createPreview({
    currency: "usd",
    customer_details: {
      address: toStripeAddressParam(customer.address),
      shipping:
        customer.shipping && shippingAddress && shippingName
          ? {
              address: shippingAddress,
              name: shippingName,
              phone: customer.shipping.phone ?? undefined,
            }
          : undefined,
      tax: customer.tax?.ip_address
        ? {
            ip_address: customer.tax.ip_address,
          }
        : undefined,
      tax_exempt: customer.tax_exempt ?? undefined,
      tax_ids: previewTaxIds,
    },
    invoice_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
  })

  return {
    amountDueCents: preview.amount_due,
    currency: preview.currency,
    id: preview.id,
  }
}

export async function getStripeAutoTopOffPaymentMethodStatus(input: {
  stripeCustomerId: string
  stripeSubscriptionId?: string | null
}): Promise<StripeAutoTopOffPaymentMethodStatus> {
  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(input.stripeCustomerId)

  if (customer.deleted) {
    return {
      customerDefaultPaymentMethodId: null,
      effectivePaymentMethodId: null,
      fallbackCustomerPaymentMethodId: null,
      hasReusablePaymentMethod: false,
      subscriptionDefaultPaymentMethodId: null,
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

  if (!input.stripeSubscriptionId) {
    return {
      customerDefaultPaymentMethodId,
      effectivePaymentMethodId: customerDefaultPaymentMethodId,
      fallbackCustomerPaymentMethodId,
      hasReusablePaymentMethod: Boolean(customerDefaultPaymentMethodId),
      subscriptionDefaultPaymentMethodId: null,
    }
  }

  const subscription = await stripe.subscriptions.retrieve(
    input.stripeSubscriptionId,
    {
      expand: ["default_payment_method"],
    },
  )
  const subscriptionDefaultPaymentMethodId = getExpandableId(
    subscription.default_payment_method,
  )
  const effectivePaymentMethodId =
    customerDefaultPaymentMethodId ?? subscriptionDefaultPaymentMethodId

  return {
    customerDefaultPaymentMethodId,
    effectivePaymentMethodId,
    fallbackCustomerPaymentMethodId,
    hasReusablePaymentMethod: Boolean(effectivePaymentMethodId),
    subscriptionDefaultPaymentMethodId,
  }
}

export async function listStripeInvoicesForCustomer(input: {
  limit?: number
  stripeCustomerId: string
}): Promise<StripeInvoiceSummary[]> {
  const stripe = getStripe()
  const invoices = await stripe.invoices.list({
    customer: input.stripeCustomerId,
    limit: input.limit ?? 12,
  })

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
  }))
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
