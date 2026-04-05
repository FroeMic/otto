import { getStripePriceIds } from "@/lib/env";

export const BILLING_PLAN_KEYS = {
  growthMonthly: "growth_monthly",
  scaleMonthly: "scale_monthly",
  starterMonthly: "starter_monthly",
} as const;

export type BillingPlanKey =
  (typeof BILLING_PLAN_KEYS)[keyof typeof BILLING_PLAN_KEYS];

export type BillingPlan = {
  creditsIncluded: number;
  key: BillingPlanKey;
  monthlyPriceUsd: number;
  name: string;
  stripePriceId: string;
};

export function getBillingPlans(): BillingPlan[] {
  const priceIds = getStripePriceIds();

  return [
    {
      creditsIncluded: 25_000,
      key: BILLING_PLAN_KEYS.starterMonthly,
      monthlyPriceUsd: 50,
      name: "Starter",
      stripePriceId: priceIds.starterMonthly,
    },
    {
      creditsIncluded: 60_000,
      key: BILLING_PLAN_KEYS.growthMonthly,
      monthlyPriceUsd: 90,
      name: "Growth",
      stripePriceId: priceIds.growthMonthly,
    },
    {
      creditsIncluded: 100_000,
      key: BILLING_PLAN_KEYS.scaleMonthly,
      monthlyPriceUsd: 200,
      name: "Scale",
      stripePriceId: priceIds.scaleMonthly,
    },
  ];
}

export function getBillingPlanByKey(key: string): BillingPlan | null {
  return getBillingPlans().find((plan) => plan.key === key) ?? null;
}

export function getBillingPlanByStripePriceId(priceId: string) {
  return (
    getBillingPlans().find((plan) => plan.stripePriceId === priceId) ?? null
  );
}
