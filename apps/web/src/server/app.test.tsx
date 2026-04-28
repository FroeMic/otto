import { afterEach, describe, expect, it, vi } from "vitest"

import { createApp } from "./app"

describe("web app", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const app = createApp({
    API_ORIGIN: "http://api.internal",
    FRONTEND_PORT: 4100,
    NEXT_PUBLIC_POSTHOG_ENABLED: false,
    NEXT_PUBLIC_POSTHOG_HOST: "/ingest",
    NODE_ENV: "test",
    POSTHOG_ASSET_PROXY_TARGET: "https://eu-assets.i.posthog.com",
    POSTHOG_PROXY_TARGET: "https://eu.i.posthog.com",
    WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
  })

  it("serves the health check", async () => {
    const response = await app.request("http://localhost/healthz")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "web",
    })
  })

  it("renders the landing page", async () => {
    const response = await app.request("http://localhost/")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("An AI employee for your team.")
    expect(text).toContain(
      "Otto helps founder-led software businesses handle onboarding, support, handoffs, and follow-through in one place.",
    )
    expect(text).toContain('aria-label="Otto avatar"')
    expect(text).toContain("/assets/workspace.css")
    expect(text).toContain("/assets/landing.js")
    expect(text).not.toContain("Product")
    expect(text).not.toContain("How it works")
    expect(text).not.toContain("Pricing")
    expect(text).not.toContain("Security")
    expect(text).not.toContain(
      "Describe the business you are trying to run. Otto will qualify the next step.",
    )
    expect(text).not.toContain("Where founders get stuck")
    expect(text).not.toContain("__OTTO_POSTHOG__")
  })

  it("injects runtime posthog config when browser analytics is enabled", async () => {
    const productionApp = createApp({
      API_ORIGIN: "http://api.internal",
      FRONTEND_PORT: 4100,
      NEXT_PUBLIC_POSTHOG_ENABLED: true,
      NEXT_PUBLIC_POSTHOG_HOST: "/ingest",
      NEXT_PUBLIC_POSTHOG_TOKEN: "phc_test_token",
      NODE_ENV: "production",
      POSTHOG_ASSET_PROXY_TARGET: "https://eu-assets.i.posthog.com",
      POSTHOG_PROXY_TARGET: "https://eu.i.posthog.com",
      WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
    })

    const response = await productionApp.request("http://localhost/")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("__OTTO_POSTHOG__")
    expect(text).toContain('"apiHost":"/ingest"')
    expect(text).toContain('"token":"phc_test_token"')
  })

  it("proxies posthog ingest requests without forwarding browser cookies", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("ok", {
        status: 202,
      }),
    )

    const productionApp = createApp({
      API_ORIGIN: "http://api.internal",
      FRONTEND_PORT: 4100,
      NEXT_PUBLIC_POSTHOG_ENABLED: true,
      NEXT_PUBLIC_POSTHOG_HOST: "/ingest",
      NEXT_PUBLIC_POSTHOG_TOKEN: "phc_test_token",
      NODE_ENV: "production",
      POSTHOG_ASSET_PROXY_TARGET: "https://eu-assets.i.posthog.com",
      POSTHOG_PROXY_TARGET: "https://eu.i.posthog.com",
      WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
    })

    const response = await productionApp.request(
      "http://localhost/ingest/e/?ip=1",
      {
        body: JSON.stringify({ event: "landing_view" }),
        headers: {
          "Content-Type": "application/json",
          Cookie: "wos-session=sealed-session",
        },
        method: "POST",
      },
    )

    expect(response.status).toBe(202)
    expect(fetchSpy).toHaveBeenCalledWith(expect.any(Request))

    const forwardedRequest = fetchSpy.mock.calls[0]?.[0]
    expect(forwardedRequest).toBeInstanceOf(Request)
    expect((forwardedRequest as Request).url).toBe(
      "https://eu.i.posthog.com/e/?ip=1",
    )
    expect((forwardedRequest as Request).headers.get("cookie")).toBeNull()
  })

  it("proxies posthog remote config requests through the assets host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ config: { token: "phc_test_token" } }), {
        headers: {
          "Content-Encoding": "br",
          "Content-Length": "123",
          "Content-Type": "application/json",
        },
        status: 200,
      }),
    )

    const productionApp = createApp({
      API_ORIGIN: "http://api.internal",
      FRONTEND_PORT: 4100,
      NEXT_PUBLIC_POSTHOG_ENABLED: true,
      NEXT_PUBLIC_POSTHOG_HOST: "/ingest",
      NEXT_PUBLIC_POSTHOG_TOKEN: "phc_test_token",
      NODE_ENV: "production",
      POSTHOG_ASSET_PROXY_TARGET: "https://eu-assets.i.posthog.com",
      POSTHOG_PROXY_TARGET: "https://eu.i.posthog.com",
      WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
    })

    const response = await productionApp.request(
      "http://localhost/ingest/array/phc_test_token/config?ip=0",
    )

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(expect.any(Request))

    const forwardedRequest = fetchSpy.mock.calls[0]?.[0]
    expect(forwardedRequest).toBeInstanceOf(Request)
    expect((forwardedRequest as Request).url).toBe(
      "https://eu-assets.i.posthog.com/array/phc_test_token/config?ip=0",
    )
    expect(response.headers.get("content-encoding")).toBeNull()
    expect(response.headers.get("content-length")).toBeNull()
  })

  it("proxies posthog feature flag requests through the ingest host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ flags: [] }), {
        status: 200,
      }),
    )

    const productionApp = createApp({
      API_ORIGIN: "http://api.internal",
      FRONTEND_PORT: 4100,
      NEXT_PUBLIC_POSTHOG_ENABLED: true,
      NEXT_PUBLIC_POSTHOG_HOST: "/ingest",
      NEXT_PUBLIC_POSTHOG_TOKEN: "phc_test_token",
      NODE_ENV: "production",
      POSTHOG_ASSET_PROXY_TARGET: "https://eu-assets.i.posthog.com",
      POSTHOG_PROXY_TARGET: "https://eu.i.posthog.com",
      WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
    })

    const response = await productionApp.request(
      "http://localhost/ingest/flags/?v=2&ip=0&compression=base64",
      {
        body: JSON.stringify({ token: "phc_test_token" }),
        headers: {
          "Content-Type": "application/json",
          Cookie: "wos-session=sealed-session",
        },
        method: "POST",
      },
    )

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(expect.any(Request))

    const forwardedRequest = fetchSpy.mock.calls[0]?.[0]
    expect(forwardedRequest).toBeInstanceOf(Request)
    expect((forwardedRequest as Request).url).toBe(
      "https://eu.i.posthog.com/flags/?v=2&ip=0&compression=base64",
    )
    expect((forwardedRequest as Request).headers.get("cookie")).toBeNull()
  })

  it("renders a landing workspace menu when the user is authenticated", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            email: "michael@getyourotto.com",
            id: "user_123",
            name: "Michael Frohlich",
          },
          workspaces: [
            {
              id: "org_1",
              isReady: true,
              name: "Interaction42",
              slug: "interaction42",
            },
            {
              id: "org_2",
              isReady: false,
              name: "Draft Workspace",
              slug: "draft-workspace",
            },
          ],
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    )

    const response = await app.request("http://localhost/", {
      headers: {
        Cookie: "wos-session=sealed-session",
      },
    })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.internal/api/user/workspaces",
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: "wos-session=sealed-session",
        }),
      }),
    )
    expect(text).toContain("Michael Frohlich")
    expect(text).toContain("Interaction42")
    expect(text).toContain("Draft Workspace")
    expect(text).toContain('aria-label="Open Interaction42"')
    expect(text).toContain('href="/interaction42"')
    expect(text).toContain('href="/draft-workspace"')
    expect(text).toContain('href="/logout"')
  })

  it("prefills the landing prompt from the query string", async () => {
    const response = await app.request(
      `http://localhost/?prompt=${encodeURIComponent("Help me run support and onboarding.")}`,
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Help me run support and onboarding.")
  })

  it("renders the pricing page", async () => {
    const response = await app.request("http://localhost/pricing")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Start building for free")
  })

  it("renders the landing auth modal and preserves the return target", async () => {
    const response = await app.request(
      "http://localhost/login?returnTo=%2Facme%2Fsettings%2Fworkspace",
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Create free account")
    expect(text).toContain("/assets/landing.js")
    expect(text).toContain(
      "/auth/sign-up?returnTo=%2Facme%2Fsettings%2Fworkspace",
    )
    expect(text).toContain(
      "/login?mode=sign-in&amp;returnTo=%2Facme%2Fsettings%2Fworkspace",
    )
  })

  it("keeps a submitted landing brief visible in the auth modal", async () => {
    const response = await app.request(
      `http://localhost/login?returnTo=%2F&prompt=${encodeURIComponent("I need help with SaaS onboarding.")}`,
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Start building.")
    expect(text).toContain("I need help with SaaS onboarding.")
    expect(text).toContain('aria-label="Otto avatar"')
    expect(text).not.toContain("/otto-avatar.svg")
    expect(text).not.toContain("Your business brief")
    expect(text).not.toContain("Otto uses WorkOS for authentication.")
  })

  it("can render a sign-in-first auth modal", async () => {
    const response = await app.request(
      "http://localhost/login?mode=sign-in&returnTo=%2Facme",
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Welcome back.")
    expect(text).toContain("Log in to Otto")
    expect(text).toContain("/auth/sign-in?returnTo=%2Facme")
    expect(text).toContain("/login?mode=sign-up&amp;returnTo=%2Facme")
  })

  it("does not own auth routes at the web layer", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await app.request("http://localhost/auth/sign-in", {
      redirect: "manual",
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(response.status).toBe(404)
  })

  it("serves a workspace slug shell fallback", async () => {
    const response = await app.request("http://localhost/acme")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('id="root"')
    expect(text).toContain("/assets/workspace.js")
  })

  it("serves nested workspace routes from the same SPA entry", async () => {
    const response = await app.request(
      "http://localhost/acme/settings/workspace",
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('id="root"')
    expect(text).toContain("/assets/workspace.js")
  })

  it("serves workspace conversation routes from the same SPA entry", async () => {
    const response = await app.request("http://localhost/acme/c/conv_123")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('id="root"')
    expect(text).toContain("/assets/workspace.js")
  })

  it("serves the platform route from the SPA entry", async () => {
    const response = await app.request("http://localhost/platform")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('id="root"')
    expect(text).toContain("/assets/workspace.js")
  })

  it("does not serve legacy /app routes", async () => {
    const response = await app.request("http://localhost/app/platform")

    expect(response.status).toBe(404)
  })
})
