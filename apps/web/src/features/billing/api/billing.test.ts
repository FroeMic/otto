import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  parseBillingOverview,
  parseBillingPreferencesResponse,
  parseBillingUrlResponse,
} from "./billing"

describe("billing api helpers", () => {
  it("parses a billing overview response with the shared contract", () => {
    const overview = parseBillingOverview({
      autoTopOff: {
        latestRun: null,
      },
      balance: {
        currentBalanceCreditsMilli: 42_000,
        latestEntryCreatedAt: null,
        totalDebitedCreditsMilli: 1_000,
        totalGrantedCreditsMilli: 43_000,
      },
      billingConfigured: true,
      currentCycleSpendCents: 1_200,
      customer: null,
      invoices: [],
      invoicesError: null,
      nextAutoReloadChargeCents: null,
      organization: {
        id: "org_1",
        name: "Otto",
        slug: "otto",
      },
      plans: [
        {
          creditsIncluded: 10_000,
          key: "basic_monthly",
          monthlyPriceUsd: 20,
          name: "Basic",
        },
      ],
      preferences: {
        autoTopOffEnabled: false,
        minimumBalanceCredits: 1_000,
        monthlySpendLimitCents: 25_000,
        topOffAmountCents: 2_000,
      },
      subscription: null,
      tenant: null,
    })

    assert.equal(overview.organization?.slug, "otto")
  })

  it("rejects a billing overview response when required fields are missing", () => {
    assert.throws(() => {
      parseBillingOverview({
        billingConfigured: true,
      })
    })
  })

  it("parses the billing preferences response with the shared contract", () => {
    const response = parseBillingPreferencesResponse({
      preferences: {
        autoTopOffEnabled: true,
        minimumBalanceCredits: 2_000,
        monthlySpendLimitCents: 50_000,
        topOffAmountCents: 5_000,
      },
    })

    assert.equal(response.preferences.autoTopOffEnabled, true)
  })

  it("parses the billing url response with the shared contract", () => {
    const response = parseBillingUrlResponse({
      url: "https://billing.example.com/session",
    })

    assert.equal(response.url, "https://billing.example.com/session")
  })
})
