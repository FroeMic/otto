import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  billingCheckoutSchema,
  billingOverviewSchema,
  billingPreferencesSchema,
} from "./index"

describe("billing feature contracts", () => {
  it("accepts valid billing preferences and rejects invalid thresholds", () => {
    assert.deepEqual(
      billingPreferencesSchema.parse({
        autoTopOffEnabled: true,
        minimumBalanceCredits: 100,
        monthlySpendLimitCents: 20_000,
        topOffAmountCents: 2_000,
      }),
      {
        autoTopOffEnabled: true,
        minimumBalanceCredits: 100,
        monthlySpendLimitCents: 20_000,
        topOffAmountCents: 2_000,
      },
    )

    assert.equal(
      billingPreferencesSchema.safeParse({
        autoTopOffEnabled: true,
        minimumBalanceCredits: -1,
        monthlySpendLimitCents: 20_000,
        topOffAmountCents: 2_000,
      }).success,
      false,
    )
  })

  it("restricts checkout requests to known billing plans", () => {
    assert.deepEqual(
      billingCheckoutSchema.parse({
        planKey: "plus_monthly",
      }),
      {
        planKey: "plus_monthly",
      },
    )

    assert.equal(
      billingCheckoutSchema.safeParse({
        planKey: "enterprise_monthly",
      }).success,
      false,
    )
  })

  it("normalizes date values in billing overview responses", () => {
    const parsed = billingOverviewSchema.parse({
      autoTopOff: {
        latestRun: null,
      },
      balance: {
        currentBalanceCreditsMilli: 10_000,
        latestEntryCreatedAt: new Date("2026-04-01T12:00:00.000Z"),
        totalDebitedCreditsMilli: 0,
        totalGrantedCreditsMilli: 10_000,
      },
      billingConfigured: true,
      currentCycleSpendCents: 0,
      customer: null,
      invoices: [],
      invoicesError: null,
      nextAutoReloadChargeCents: null,
      organization: {
        id: "org_1",
        name: "Acme",
        slug: "acme",
      },
      plans: [],
      preferences: {
        autoTopOffEnabled: false,
        minimumBalanceCredits: 0,
        monthlySpendLimitCents: 0,
        topOffAmountCents: 0,
      },
      subscription: null,
      tenant: null,
    })

    assert.equal(
      parsed.balance.latestEntryCreatedAt,
      "2026-04-01T12:00:00.000Z",
    )
  })
})
