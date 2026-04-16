import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { resolveApiEnv } from "./env"

describe("api env", () => {
  it("derives the public app base url from LANDING_PAGE_DOMAIN", () => {
    const env = resolveApiEnv({
      LANDING_PAGE_DOMAIN: "getyourotto.com",
      WORKOS_API_KEY: "sk_test_123",
      WORKOS_BASE_URL: "https://getyourotto.com",
      WORKOS_CLIENT_ID: "client_123",
      WORKOS_COOKIE_PASSWORD: "a".repeat(32),
      WORKOS_REDIRECT_URI: "https://getyourotto.com/auth/callback",
    })

    assert.equal(env.PUBLIC_APP_BASE_URL, "https://getyourotto.com")
    assert.equal(
      env.WORKOS_REDIRECT_URI,
      "https://getyourotto.com/auth/callback",
    )
  })

  it("derives the effective control-plane domain from LANDING_PAGE_DOMAIN", () => {
    const env = resolveApiEnv({
      LANDING_PAGE_DOMAIN: "getyourotto.com",
      WORKOS_API_KEY: "sk_test_123",
      WORKOS_CLIENT_ID: "client_123",
      WORKOS_COOKIE_PASSWORD: "a".repeat(32),
    })

    assert.equal(env.PUBLIC_APP_BASE_URL, "https://getyourotto.com")
    assert.equal(
      env.WORKOS_REDIRECT_URI,
      "https://getyourotto.com/auth/callback",
    )
  })

  it("falls back to WORKOS_BASE_URL when LANDING_PAGE_DOMAIN is absent", () => {
    const env = resolveApiEnv({
      WORKOS_API_KEY: "sk_test_123",
      WORKOS_BASE_URL: "https://getyourotto.com",
      WORKOS_CLIENT_ID: "client_123",
      WORKOS_COOKIE_PASSWORD: "a".repeat(32),
    })

    assert.equal(env.PUBLIC_APP_BASE_URL, "https://getyourotto.com")
  })

  it("defaults onboarding provisioning mode to the legacy base-image path", () => {
    const env = resolveApiEnv({})

    assert.equal(
      env.HETZNER_ONBOARDING_PROVISIONING_MODE,
      "legacy_base_image",
    )
  })

  it("parses the snapshot onboarding provisioning mode when enabled", () => {
    const env = resolveApiEnv({
      HETZNER_ONBOARDING_PROVISIONING_MODE: "hetzner_snapshot",
    })

    assert.equal(env.HETZNER_ONBOARDING_PROVISIONING_MODE, "hetzner_snapshot")
  })
})
