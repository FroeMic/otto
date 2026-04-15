import { describe, expect, it } from "vitest"

import { BILLING_PLAN_KEYS } from "./plans"
import {
  buildInitialWorkspaceCreditGrantInput,
  buildSubscriptionRecordFromStripe,
  INITIAL_WORKSPACE_CREDITS,
} from "./data"

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

  it("builds a deterministic initial workspace credit grant", () => {
    expect(
      buildInitialWorkspaceCreditGrantInput({
        tenantId: "d22613d3-5afe-4c63-9d08-0c8cbf8d311e",
      }),
    ).toEqual({
      creditsDeltaMilli: INITIAL_WORKSPACE_CREDITS * 1_000,
      description: `Initial workspace credits (${INITIAL_WORKSPACE_CREDITS} credits)`,
      sourceId: "d22613d3-5afe-4c63-9d08-0c8cbf8d311e",
      sourceType: "workspace_initial_grant",
    })
  })
})
