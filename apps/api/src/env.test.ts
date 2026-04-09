import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { resolveApiEnv } from "./env"

describe("api env", () => {
  it("prefers WORKOS_*_BETA URLs for the extracted stack", () => {
    const env = resolveApiEnv({
      CONTROL_PLANE_DOMAIN: "app.getyourotto.com",
      LANDING_PAGE_DOMAIN: "getyourotto.com",
      WORKOS_API_KEY: "sk_test_123",
      WORKOS_BASE_URL: "https://app.getyourotto.com",
      WORKOS_BASE_URL_BETA: "https://getyourotto.com",
      WORKOS_CLIENT_ID: "client_123",
      WORKOS_COOKIE_PASSWORD: "a".repeat(32),
      WORKOS_REDIRECT_URI: "https://app.getyourotto.com/auth/callback",
      WORKOS_REDIRECT_URI_BETA: "https://getyourotto.com/auth/callback",
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

    assert.equal(env.CONTROL_PLANE_DOMAIN, "getyourotto.com")
    assert.equal(env.PUBLIC_APP_BASE_URL, "https://getyourotto.com")
    assert.equal(
      env.WORKOS_REDIRECT_URI,
      "https://getyourotto.com/auth/callback",
    )
  })

  it("prefers LANDING_PAGE_DOMAIN over a legacy CONTROL_PLANE_DOMAIN", () => {
    const env = resolveApiEnv({
      CONTROL_PLANE_DOMAIN: "app.getyourotto.com",
      LANDING_PAGE_DOMAIN: "getyourotto.com",
      WORKOS_API_KEY: "sk_test_123",
      WORKOS_CLIENT_ID: "client_123",
      WORKOS_COOKIE_PASSWORD: "a".repeat(32),
    })

    assert.equal(env.CONTROL_PLANE_DOMAIN, "getyourotto.com")
    assert.equal(env.PUBLIC_APP_BASE_URL, "https://getyourotto.com")
  })
})
