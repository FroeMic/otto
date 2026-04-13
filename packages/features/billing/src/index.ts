import { z } from "zod"

// ─── Plan constants (shared between API, worker, and web) ─────────────────────

export const BILLING_PLAN_KEYS = {
  basicMonthly: "basic_monthly",
  maxMonthly: "max_monthly",
  plusMonthly: "plus_monthly",
  proMonthly: "pro_monthly",
} as const

export type BillingPlanKey =
  (typeof BILLING_PLAN_KEYS)[keyof typeof BILLING_PLAN_KEYS]

export interface BillingPlanDefinition {
  creditsIncluded: number
  key: BillingPlanKey
  monthlyPriceUsd: number
  name: string
}

/** Credits included in the free tier per month (no Stripe subscription). */
export const FREE_PLAN_CREDITS = 1_000

export const BILLING_PAID_PLAN_DEFINITIONS: BillingPlanDefinition[] = [
  {
    creditsIncluded: 10_000,
    key: BILLING_PLAN_KEYS.basicMonthly,
    monthlyPriceUsd: 20,
    name: "Basic",
  },
  {
    creditsIncluded: 30_000,
    key: BILLING_PLAN_KEYS.plusMonthly,
    monthlyPriceUsd: 50,
    name: "Plus",
  },
  {
    creditsIncluded: 70_000,
    key: BILLING_PLAN_KEYS.proMonthly,
    monthlyPriceUsd: 100,
    name: "Pro",
  },
  {
    creditsIncluded: 150_000,
    key: BILLING_PLAN_KEYS.maxMonthly,
    monthlyPriceUsd: 200,
    name: "Max",
  },
]

// ─── Zod schemas ──────────────────────────────────────────────────────────────

function createJsonDateSchema() {
  return z.union([z.date(), z.string()]).transform((value) => {
    return value instanceof Date ? value.toISOString() : value
  })
}

const jsonDateSchema = createJsonDateSchema()

export const billingPlanKeySchema = z.enum([
  "basic_monthly",
  "plus_monthly",
  "pro_monthly",
  "max_monthly",
])

export const billingPreferencesSchema = z.object({
  autoTopOffEnabled: z.boolean(),
  minimumBalanceCredits: z.number().int().min(0).max(1_000_000),
  monthlySpendLimitCents: z.number().int().min(0).max(1_000_000),
  topOffAmountCents: z.number().int().min(0).max(1_000_000),
})

export const billingPlanSchema = z.object({
  creditsIncluded: z.number(),
  key: billingPlanKeySchema,
  monthlyPriceUsd: z.number(),
  name: z.string(),
})

export const billingInvoiceSummarySchema = z.object({
  amountDueCents: z.number(),
  amountPaidCents: z.number(),
  createdAt: jsonDateSchema,
  currency: z.string(),
  hostedInvoiceUrl: z.string().nullable(),
  id: z.string(),
  invoicePdfUrl: z.string().nullable(),
  number: z.string().nullable(),
  status: z.string().nullable(),
})

export const billingAutoTopOffRunSummarySchema = z.object({
  completedAt: jsonDateSchema.nullable(),
  createdAt: jsonDateSchema,
  creditsGrantedMilli: z.number(),
  failureReason: z.string().nullable(),
  status: z.string(),
  stripeInvoiceId: z.string().nullable(),
  topOffAmountCents: z.number(),
})

export const billingOverviewSchema = z.object({
  autoTopOff: z.object({
    latestRun: billingAutoTopOffRunSummarySchema.nullable(),
  }),
  balance: z.object({
    currentBalanceCreditsMilli: z.number(),
    latestEntryCreatedAt: jsonDateSchema.nullable(),
    totalDebitedCreditsMilli: z.number(),
    totalGrantedCreditsMilli: z.number(),
  }),
  billingConfigured: z.boolean(),
  currentCycleSpendCents: z.number(),
  customer: z
    .object({
      defaultCurrency: z.string(),
      stripeCustomerId: z.string(),
    })
    .nullable(),
  invoices: z.array(billingInvoiceSummarySchema),
  invoicesError: z.string().nullable(),
  nextAutoReloadChargeCents: z.number().nullable(),
  organization: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
  plans: z.array(billingPlanSchema),
  preferences: billingPreferencesSchema,
  subscription: z
    .object({
      cancelAtPeriodEnd: z.boolean(),
      currentPeriodEnd: jsonDateSchema.nullable(),
      currentPeriodStart: jsonDateSchema.nullable(),
      planKey: billingPlanKeySchema.nullable(),
      status: z.string(),
      stripeSubscriptionId: z.string(),
      trialEnd: jsonDateSchema.nullable(),
    })
    .nullable(),
  tenant: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
})

export const billingPreferencesResponseSchema = z.object({
  preferences: billingPreferencesSchema,
})

export const billingUrlResponseSchema = z.object({
  url: z.string().nullable(),
})

export const billingCheckoutSchema = z.object({
  planKey: billingPlanKeySchema,
})

export type BillingOverview = z.infer<typeof billingOverviewSchema>
export type BillingPreferences = z.infer<typeof billingPreferencesSchema>
export type BillingPreferencesResponse = z.infer<
  typeof billingPreferencesResponseSchema
>
export type BillingUrlResponse = z.infer<typeof billingUrlResponseSchema>
