import { afterEach, describe, expect, it, vi } from "vitest"

import { createApp } from "./app"

describe("web app", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const app = createApp({
    API_ORIGIN: "http://api.internal",
    FRONTEND_PORT: 4100,
    NODE_ENV: "test",
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
    expect(text).toContain("Build the product. Otto helps build the business.")
    expect(text).toContain(
      "Building software is getting solved. Running the business is not.",
    )
    expect(text).toContain("Where founders get stuck")
    expect(text).toContain("/assets/workspace.css")
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
    expect(text).toContain("Start with one clear path into Otto")
  })

  it("renders a same-origin login page that preserves the return target", async () => {
    const response = await app.request(
      "http://localhost/login?returnTo=%2Facme%2Fsettings%2Fworkspace",
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Sign in to continue with Otto")
    expect(text).toContain(
      "/auth/sign-in?returnTo=%2Facme%2Fsettings%2Fworkspace",
    )
  })

  it("keeps a submitted landing brief visible on the login page", async () => {
    const response = await app.request(
      `http://localhost/login?returnTo=%2F&prompt=${encodeURIComponent("I need help with SaaS onboarding.")}`,
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Your business brief")
    expect(text).toContain("I need help with SaaS onboarding.")
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
