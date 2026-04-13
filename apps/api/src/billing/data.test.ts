import { describe, expect, it } from "vitest"

import { BILLING_PLAN_KEYS } from "./plans"
import { buildSubscriptionRecordFromStripe } from "./data"

describe("buildSubscriptionRecordFromStripe", () => {
  it("maps known Stripe lookup keys to billing plan keys", () => {
    const record = buildSubscriptionRecordFromStripe({
      organizationId: "org_123",
      subscription: {
        cancel_at_period_end: false,
        current_period_end: 1_700_000_000,
        current_period_start: 1_699_000_000,
        customer: "cus_123",
        id: "sub_123",
        items: [
          {
            price: {
              id: "price_123",
              lookupKey: BILLING_PLAN_KEYS.plusMonthly,
            },
          },
        ],
        status: "active",
        trial_end: null,
      },
    })

    expect(record.planKey).toBe(BILLING_PLAN_KEYS.plusMonthly)
  })

  it("keeps the plan key null for unknown Stripe lookup keys", () => {
    const record = buildSubscriptionRecordFromStripe({
      organizationId: "org_123",
      subscription: {
        cancel_at_period_end: false,
        current_period_end: 1_700_000_000,
        current_period_start: 1_699_000_000,
        customer: "cus_123",
        id: "sub_123",
        items: [
          {
            price: {
              id: "price_123",
              lookupKey: "unknown_plan",
            },
          },
        ],
        status: "active",
        trial_end: null,
      },
    })

    expect(record.planKey).toBeNull()
  })
})
