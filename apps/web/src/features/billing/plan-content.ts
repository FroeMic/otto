export const billingPlanDescriptions: Record<string, string> = {
  basic_monthly: "For individuals getting started with Otto.",
  max_monthly: "For high-volume workspaces with dedicated needs.",
  plus_monthly: "For growing teams with regular usage.",
  pro_monthly: "For teams that rely on Otto every day.",
}

export const billingPlanFeatures: Record<string, string[]> = {
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
