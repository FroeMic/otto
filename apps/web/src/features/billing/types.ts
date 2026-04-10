export interface BillingAutoTopOffRunSummary {
  completedAt: string | Date | null
  createdAt: string | Date
  creditsGrantedMilli: number
  failureReason: string | null
  status: string
  stripeInvoiceId: string | null
  topOffAmountCents: number
}

export interface BillingPlan {
  creditsIncluded: number
  key: string
  monthlyPriceUsd: number
  name: string
}

export interface BillingPreferences {
  autoTopOffEnabled: boolean
  minimumBalanceCredits: number
  monthlySpendLimitCents: number
  topOffAmountCents: number
}

export interface BillingInvoiceSummary {
  amountDueCents: number
  amountPaidCents: number
  createdAt: string | Date
  currency: string
  hostedInvoiceUrl: string | null
  id: string
  invoicePdfUrl: string | null
  number: string | null
  status: string | null
}

export interface BillingOverview {
  autoTopOff: {
    latestRun: BillingAutoTopOffRunSummary | null
  }
  balance: {
    currentBalanceCreditsMilli: number
    latestEntryCreatedAt: string | Date | null
    totalDebitedCreditsMilli: number
    totalGrantedCreditsMilli: number
  }
  billingConfigured: boolean
  currentCycleSpendCents: number
  customer: {
    defaultCurrency: string
    stripeCustomerId: string
  } | null
  invoices: BillingInvoiceSummary[]
  invoicesError: string | null
  nextAutoReloadChargeCents: number | null
  organization: {
    id: string
    name: string
    slug: string
  } | null
  plans: BillingPlan[]
  preferences: BillingPreferences
  subscription: {
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | Date | null
    currentPeriodStart: string | Date | null
    planKey: string | null
    status: string
    stripeSubscriptionId: string
    trialEnd: string | Date | null
  } | null
  tenant: {
    id: string
    name: string
  } | null
}
