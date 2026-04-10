export const CREDIT_LEDGER_ENTRY_TYPES = {
  manualGrant: "manual_grant",
  subscriptionGrant: "subscription_grant",
  topUpGrant: "top_up_grant",
} as const

export function formatCreditsFromMilli(creditsMilli: number) {
  return Math.round(creditsMilli / 1_000)
}
