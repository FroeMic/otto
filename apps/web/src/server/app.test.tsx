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
    expect(text).toContain("Public site placeholder")
    expect(text).toContain("/assets/workspace.css")
  })

  it("renders the pricing page", async () => {
    const response = await app.request("http://localhost/pricing")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Keep the first pricing story simple.")
  })

  it("renders a same-origin login page that preserves the return target", async () => {
    const response = await app.request(
      "http://localhost/login?returnTo=%2Facme%2Fsettings%2Fworkspace",
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Sign in to your workspace")
    expect(text).toContain(
      "/auth/sign-in?returnTo=%2Facme%2Fsettings%2Fworkspace",
    )
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

  it("serves the platform route from the SPA entry", async () => {
    const response = await app.request("http://localhost/platform")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('id="root"')
    expect(text).toContain("/assets/workspace.js")
  })

  it("redirects legacy /app workspace links to slug-based paths", async () => {
    const response = await app.request(
      "http://localhost/app/acme/settings/workspace",
      { redirect: "manual" },
    )

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/acme/settings/workspace")
  })

  it("redirects legacy /app/platform links to platform", async () => {
    const response = await app.request("http://localhost/app/platform", {
      redirect: "manual",
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/platform")
  })
})
