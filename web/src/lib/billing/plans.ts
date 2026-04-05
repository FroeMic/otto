export const BILLING_PLAN_KEYS = {
  basicMonthly: "basic_monthly",
  maxMonthly: "max_monthly",
  plusMonthly: "plus_monthly",
  proMonthly: "pro_monthly",
} as const;

export type BillingPlanKey =
  (typeof BILLING_PLAN_KEYS)[keyof typeof BILLING_PLAN_KEYS];

export type BillingPlan = {
  creditsIncluded: number;
  key: BillingPlanKey;
  monthlyPriceUsd: number;
  name: string;
};

export function getBillingPlans(): BillingPlan[] {
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
  ];
}

export function getBillingPlanByKey(key: string): BillingPlan | null {
  return getBillingPlans().find((plan) => plan.key === key) ?? null;
}
