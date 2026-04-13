import {
  BILLING_PAID_PLAN_DEFINITIONS,
  BILLING_PLAN_KEYS,
  type BillingPlanKey,
} from "@otto/feature-billing"

export { BILLING_PLAN_KEYS } from "@otto/feature-billing"
export type { BillingPlanKey } from "@otto/feature-billing"

export type BillingPlan = {
  creditsIncluded: number
  key: BillingPlanKey
  monthlyPriceUsd: number
  name: string
}

export type AutoTopOffPack = {
  amountCents: number
  creditsGranted: number
  label: string
  lookupKey: string
}

export function getBillingPlans(): BillingPlan[] {
  return BILLING_PAID_PLAN_DEFINITIONS
}

export function getBillingPlanByKey(key: string) {
  return getBillingPlans().find((plan) => plan.key === key) ?? null
}

export function getAutoTopOffPacks(): AutoTopOffPack[] {
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

export function getAutoTopOffPackByLookupKey(lookupKey: string) {
  return (
    getAutoTopOffPacks().find((pack) => pack.lookupKey === lookupKey) ?? null
  )
}
