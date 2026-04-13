export const billingPlanDescriptions: Record<string, string> = {
  free: "Try Otto at no cost. No credit card required.",
  basic_monthly: "For individuals getting started with Otto.",
  max_monthly: "For high-volume workspaces with dedicated needs.",
  plus_monthly: "For growing teams with regular usage.",
  pro_monthly: "For teams that rely on Otto every day.",
}

export const billingPlanFeatures: Record<string, string[]> = {
  free: [
    "1,000 credits per month",
    "No credit card required",
    "Access to Otto workspace",
  ],
  basic_monthly: [
    "Monthly prepaid credits",
    "Managed in Stripe billing",
    "Auto-reload eligible",
  ],
  max_monthly: [
    "Monthly prepaid credits",
    "Dedicated support",
    "Auto-reload eligible",
  ],
  plus_monthly: [
    "Monthly prepaid credits",
    "Managed in Stripe billing",
    "Auto-reload eligible",
  ],
  pro_monthly: [
    "Monthly prepaid credits",
    "Priority support",
    "Auto-reload eligible",
  ],
}
