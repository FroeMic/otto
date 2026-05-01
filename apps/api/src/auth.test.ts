import assert from "node:assert/strict"

import { readAuthFlowState, sealAuthFlowState } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import { registerAuthRoutes } from "./auth"

describe("native auth routes", () => {
  it("redirects sign-in to a native WorkOS authorization URL", async () => {
    const app = new Hono()

    registerAuthRoutes(app, {
      buildAuthorizationUrl: async ({ sealedState, screenHint }) =>
        `https://example.workos.com/${screenHint}?state=${encodeURIComponent(sealedState)}`,
      clearWorkspaceSessionCookie: () => "wos-session=; Path=/; Max-Age=0",
      exchangeCodeForSession: async () => {
        throw new Error("not used")
      },
      getConfig: () => ({
        cookiePassword: "a".repeat(32),
        enabled: true,
        publicBaseUrl: "https://getyourotto.com",
      }),
      getLogoutUrlFromSessionCookie: async () =>
        "https://example.workos.com/logout",
      getPostAuthRedirectPath: async ({ defaultReturnTo }) => defaultReturnTo,
      readAuthFlowState: (input) =>
        Promise.resolve({
          returnTo: `/decoded/${input.sealedState}`,
        }),
      sealAuthFlowState: async () => "signed-state",
      setWorkspaceSessionCookie: () =>
        "wos-session=sealed; Path=/; HttpOnly; SameSite=Lax; Secure",
    })

    const response = await app.request(
      "https://api.getyourotto.com/auth/sign-in?returnTo=/app/acme",
      { redirect: "manual" },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://example.workos.com/sign-in?state=signed-state",
    )
  })

  it("redirects public sign-up attempts back to the waitlist", async () => {
    const app = new Hono()

    registerAuthRoutes(app, {
      buildAuthorizationUrl: async () => {
        throw new Error("should not start a sign-up flow")
      },
      clearWorkspaceSessionCookie: () => "wos-session=; Path=/; Max-Age=0",
      exchangeCodeForSession: async () => {
        throw new Error("not used")
      },
      getConfig: () => ({
        cookiePassword: "a".repeat(32),
        enabled: true,
        publicBaseUrl: "https://getyourotto.com",
      }),
      getLogoutUrlFromSessionCookie: async () =>
        "https://example.workos.com/logout",
      getPostAuthRedirectPath: async ({ defaultReturnTo }) => defaultReturnTo,
      readAuthFlowState: (input) =>
        Promise.resolve({
          returnTo: `/decoded/${input.sealedState}`,
        }),
      sealAuthFlowState: async () => "signed-state",
      setWorkspaceSessionCookie: () =>
        "wos-session=sealed; Path=/; HttpOnly; SameSite=Lax; Secure",
    })

    const response = await app.request(
      "https://api.getyourotto.com/auth/sign-up?returnTo=/acme",
      { redirect: "manual" },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://getyourotto.com/waitlist",
    )
  })

  it("completes the callback, stores the session cookie, and redirects to the original returnTo", async () => {
    const app = new Hono()
    const sealedState = await sealAuthFlowState({
      password: "a".repeat(32),
      payload: {
        returnTo: "/app/acme/settings/workspace",
      },
    })

    registerAuthRoutes(app, {
      buildAuthorizationUrl: async () => "https://example.workos.com/sign-in",
      clearWorkspaceSessionCookie: () => "wos-session=; Path=/; Max-Age=0",
      exchangeCodeForSession: async ({ code }) => {
        assert.equal(code, "code_123")

        return {
          sealedSession: "sealed-session-value",
          user: {
            email: "michael@getyourotto.com",
            id: "user_123",
          },
        }
      },
      getConfig: () => ({
        cookiePassword: "a".repeat(32),
        enabled: true,
        publicBaseUrl: "https://getyourotto.com",
      }),
      getLogoutUrlFromSessionCookie: async () =>
        "https://example.workos.com/logout",
      getPostAuthRedirectPath: async ({ defaultReturnTo }) => defaultReturnTo,
      readAuthFlowState,
      sealAuthFlowState,
      setWorkspaceSessionCookie: ({ sealedSession }) =>
        `wos-session=${sealedSession}; Path=/; HttpOnly; SameSite=Lax; Secure`,
    })

    const response = await app.request(
      `https://api.getyourotto.com/auth/callback?code=code_123&state=${encodeURIComponent(sealedState)}`,
      { redirect: "manual" },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://getyourotto.com/app/acme/settings/workspace",
    )
    assert.equal(
      response.headers.get("set-cookie"),
      "wos-session=sealed-session-value; Path=/; HttpOnly; SameSite=Lax; Secure",
    )
  })

  it("redirects first-time users into workspace onboarding after callback", async () => {
    const app = new Hono()
    const sealedState = await sealAuthFlowState({
      password: "a".repeat(32),
      payload: {
        returnTo: "/?intake=session_123",
      },
    })

    registerAuthRoutes(app, {
      buildAuthorizationUrl: async () => "https://example.workos.com/sign-in",
      clearWorkspaceSessionCookie: () => "wos-session=; Path=/; Max-Age=0",
      exchangeCodeForSession: async () => ({
        sealedSession: "sealed-session-value",
        user: {
          email: "michael@getyourotto.com",
          id: "user_123",
        },
      }),
      getConfig: () => ({
        cookiePassword: "a".repeat(32),
        enabled: true,
        publicBaseUrl: "https://getyourotto.com",
      }),
      getLogoutUrlFromSessionCookie: async () =>
        "https://example.workos.com/logout",
      getPostAuthRedirectPath: async ({ intakeSessionId, user }) => {
        assert.equal(intakeSessionId, "session_123")
        assert.equal(user.id, "user_123")

        return "/interaction42/onboarding"
      },
      readAuthFlowState,
      sealAuthFlowState,
      setWorkspaceSessionCookie: ({ sealedSession }) =>
        `wos-session=${sealedSession}; Path=/; HttpOnly; SameSite=Lax; Secure`,
    })

    const response = await app.request(
      `https://api.getyourotto.com/auth/callback?code=code_123&state=${encodeURIComponent(sealedState)}`,
      { redirect: "manual" },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://getyourotto.com/interaction42/onboarding",
    )
  })

  it("clears the session cookie on sign-out and redirects through WorkOS logout", async () => {
    const app = new Hono()

    registerAuthRoutes(app, {
      buildAuthorizationUrl: async () => "https://example.workos.com/sign-in",
      clearWorkspaceSessionCookie: () =>
        "wos-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
      exchangeCodeForSession: async () => {
        throw new Error("not used")
      },
      getConfig: () => ({
        cookiePassword: "a".repeat(32),
        enabled: true,
        publicBaseUrl: "https://getyourotto.com",
      }),
      getLogoutUrlFromSessionCookie: async ({ sessionData }) => {
        assert.equal(sessionData, "sealed-session-value")

        return "https://example.workos.com/logout"
      },
      getPostAuthRedirectPath: async ({ defaultReturnTo }) => defaultReturnTo,
      readAuthFlowState,
      sealAuthFlowState,
      setWorkspaceSessionCookie: () =>
        "wos-session=sealed; Path=/; HttpOnly; SameSite=Lax; Secure",
    })

    const response = await app.request(
      "https://api.getyourotto.com/auth/sign-out",
      {
        headers: {
          cookie: "wos-session=sealed-session-value",
        },
        redirect: "manual",
      },
    )

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://example.workos.com/logout",
    )
    assert.equal(
      response.headers.get("set-cookie"),
      "wos-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
    )
  })
})
