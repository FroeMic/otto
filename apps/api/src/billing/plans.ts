export const BILLING_PLAN_KEYS = {
  basicMonthly: "basic_monthly",
  maxMonthly: "max_monthly",
  plusMonthly: "plus_monthly",
  proMonthly: "pro_monthly",
} as const

export type BillingPlanKey =
  (typeof BILLING_PLAN_KEYS)[keyof typeof BILLING_PLAN_KEYS]

type BillingPlan = {
  creditsIncluded: number
  key: BillingPlanKey
  monthlyPriceUsd: number
  name: string
}

type AutoTopOffPack = {
  amountCents: number
  creditsGranted: number
  label: string
  lookupKey: string
}

function getBillingPlans(): BillingPlan[] {
  return [
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
}

function getAutoTopOffPacks(): AutoTopOffPack[] {
  return [
    {
      amountCents: 2_000,
      creditsGranted: 10_000,
      label: "Basic top-up",
      lookupKey: "top_up_20",
    },
    {
      amountCents: 5_000,
      creditsGranted: 30_000,
      label: "Plus top-up",
      lookupKey: "top_up_50",
    },
    {
      amountCents: 10_000,
      creditsGranted: 70_000,
      label: "Pro top-up",
      lookupKey: "top_up_100",
    },
    {
      amountCents: 20_000,
      creditsGranted: 150_000,
      label: "Max top-up",
      lookupKey: "top_up_200",
    },
  ]
}

export function getBillingPlanByKey(key: string) {
  return getBillingPlans().find((plan) => plan.key === key) ?? null
}

export function getAutoTopOffPackByLookupKey(lookupKey: string) {
  return (
    getAutoTopOffPacks().find((pack) => pack.lookupKey === lookupKey) ?? null
  )
}
